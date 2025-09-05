import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { User, UserDocument } from '../schemas/user.schema';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from '../otp/otp.service';
import { ResponseHelper, ERROR_CODES } from '../core/utils/response.helper';
import { ApiResponse } from '../core/types/api-response.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private otpService: OtpService,
  ) {}

  async sendOtp(phone: string): Promise<ApiResponse> {
    const otp = await this.otpService.generateOtp(phone);
    await this.otpService.sendOtp(phone, otp);
    return ResponseHelper.message('OTP sent successfully');
  }

  async verifyOtp(
    { phone, otp }: VerifyOtpDto,
    res: Response,
  ): Promise<ApiResponse<{ access_token: string; user: User }>> {
    const isValid = await this.otpService.validateOtp(phone, otp);
    if (!isValid) {
      throw new UnauthorizedException(
        ResponseHelper.error(
          'Invalid OTP code',
          ERROR_CODES.INVALID_OTP,
        ).message,
      );
    }

    let user = await this.userModel.findOne({ phone });
    if (!user) {
      user = new this.userModel({ phone });
      await user.save();
    }

    const tokens = this.generateTokens(user._id.toString(), user.phone);

    // Устанавливаем refresh token в httpOnly cookie
    this.setRefreshTokenCookie(res, tokens.refresh_token);

    return ResponseHelper.success(
      {
        access_token: tokens.access_token,
        user: user.toObject(),
      },
      'OTP verified successfully',
    );
  }

  async refreshToken(
    refresh_token: string,
    res: Response,
  ): Promise<ApiResponse<{ access_token: string }>> {
    if (!refresh_token) {
      res.clearCookie('refresh_token');
      throw new UnauthorizedException(
        ResponseHelper.error(
          'Refresh token not found',
          ERROR_CODES.INVALID_TOKEN,
        ).message,
      );
    }

    try {
      const payload = this.jwtService.verify(refresh_token);
      const user = await this.userModel.findById(payload.sub);

      if (!user) {
        res.clearCookie('refresh_token');
        throw new UnauthorizedException(
          ResponseHelper.error(
            'User not found',
            ERROR_CODES.INVALID_TOKEN,
          ).message,
        );
      }

      const tokens = this.generateTokens(payload.sub, payload.phone);

      // Обновляем refresh token в cookie
      this.setRefreshTokenCookie(res, tokens.refresh_token);

      return ResponseHelper.success(
        {
          access_token: tokens.access_token,
          user: user.toObject(),
        },
        'Token refreshed successfully',
      );
    } catch (error) {
      res.clearCookie('refresh_token');
      throw new UnauthorizedException(
        ResponseHelper.error(
          'Invalid refresh token',
          ERROR_CODES.INVALID_TOKEN,
          error.message,
        ).message,
      );
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

  async logout(res: Response): Promise<ApiResponse> {
    res.clearCookie('refresh_token');
    return ResponseHelper.message('Logged out successfully');
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS в продакшене
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
      path: '/', // Доступен для всех путей
    });
  }
}
