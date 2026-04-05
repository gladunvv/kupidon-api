import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { User, UserDocument } from '../users/schemas/user.schema';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from '../otp/otp.service';
import { ERROR_CODES } from 'src/core/http/error-codes';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private otpService: OtpService,
  ) {}

  async sendOtp(phone: string): Promise<void> {
    const otp = await this.otpService.generateOtp(phone);
    await this.otpService.sendOtp(phone, otp);
  }

  async verifyOtp(
    { phone, otp }: VerifyOtpDto,
    res: Response,
  ): Promise<{ access_token: string; user: User }> {
    const isValid = await this.otpService.validateOtp(phone, otp);
    if (!isValid) {
      throw new UnauthorizedException({
        message: 'Invalid OTP code',
        code: ERROR_CODES.INVALID_OTP,
      });
    }

    let user = await this.userModel.findOne({ phone });
    if (!user) {
      user = new this.userModel({ phone });
      await user.save();
    }

    const tokens = this.generateTokens(user._id.toString(), user.phone);

    this.setRefreshTokenCookie(res, tokens.refresh_token);

    return {
      access_token: tokens.access_token,
      user: user.toObject(),
    };
  }

  async refreshToken(
    refresh_token: string,
    res: Response,
  ): Promise<{ access_token: string; user: User }> {
    if (!refresh_token) {
      res.clearCookie('refresh_token');
      throw new UnauthorizedException({
        message: 'Refresh token not found',
        code: ERROR_CODES.INVALID_TOKEN,
      });
    }

    try {
      const payload = this.jwtService.verify(refresh_token);
      const user = await this.userModel.findById(payload.sub);

      if (!user) {
        res.clearCookie('refresh_token');
        throw new UnauthorizedException({
          message: 'User not found',
          code: ERROR_CODES.INVALID_TOKEN,
        });
      }

      const tokens = this.generateTokens(payload.sub, payload.phone);

      this.setRefreshTokenCookie(res, tokens.refresh_token);

      return {
        access_token: tokens.access_token,
        user: user.toObject(),
      };
    } catch (error) {
      res.clearCookie('refresh_token');
      throw new UnauthorizedException({
        message: 'Invalid refresh token',
        code: ERROR_CODES.INVALID_TOKEN,
        details: error.message,
      });
    }
  }

  private generateTokens(
    userId: string,
    phone: string,
  ): { access_token: string; refresh_token: string } {
    const payload = { sub: userId, phone };
    const access_token = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refresh_token = this.jwtService.sign(payload, { expiresIn: '7d' });
    return { access_token, refresh_token };
  }

  async logout(res: Response): Promise<void> {
    res.clearCookie('refresh_token');
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
}
