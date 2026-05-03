import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { User, UserDocument } from '../users/schemas/user.schema';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from '../otp/otp.service';
import { ERROR_CODES } from '../core/http/error-codes';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { JwtConfig } from '../config/config.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private otpService: OtpService,
    private configService: ConfigService,
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

    user.refreshTokenHash = await bcrypt.hash(tokens.refresh_token, 10);
    await user.save();

    this.setRefreshTokenCookie(res, tokens.refresh_token);

    return {
      access_token: tokens.access_token,
      user: this.toSafeUser(user),
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
      const payload = this.jwtService.verify(refresh_token, {
        secret: this.jwtConfig.secret_refresh,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException({
          message: 'Invalid token type',
          code: ERROR_CODES.INVALID_TOKEN,
        });
      }

      const user = await this.userModel
        .findById(payload.sub)
        .select('+refreshTokenHash');

      if (!user) {
        res.clearCookie('refresh_token');
        throw new UnauthorizedException({
          message: 'User not found',
          code: ERROR_CODES.INVALID_TOKEN,
        });
      }

      if (!user.refreshTokenHash) {
        throw new UnauthorizedException();
      }

      const isValid = await bcrypt.compare(
        refresh_token,
        user.refreshTokenHash,
      );

      if (!isValid) {
        throw new UnauthorizedException({
          message: 'Invalid refresh token',
          code: ERROR_CODES.INVALID_TOKEN,
        });
      }

      const tokens = this.generateTokens(payload.sub, payload.phone);

      user.refreshTokenHash = await bcrypt.hash(tokens.refresh_token, 10);
      await user.save();

      this.setRefreshTokenCookie(res, tokens.refresh_token);

      return {
        access_token: tokens.access_token,
        user: this.toSafeUser(user),
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
    const payload = { sub: userId, phone, type: 'access' };
    const refresh_payload = { sub: userId, phone, type: 'refresh' };
    const access_token = this.jwtService.sign(payload, {
      expiresIn: this.jwtConfig.accessExpiresIn,
      secret: this.jwtConfig.secret,
    });
    const refresh_token = this.jwtService.sign(refresh_payload, {
      expiresIn: this.jwtConfig.refreshExpiresIn,
      secret: this.jwtConfig.secret_refresh,
    });
    return { access_token, refresh_token };
  }

  async logout(userId: string, res: Response): Promise<void> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { refreshTokenHash: null },
      { new: false },
    );

    if (!user) {
      throw new UnauthorizedException({
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    res.clearCookie('refresh_token');
  }

  private toSafeUser(user: UserDocument): User {
    const plainUser = user.toObject();
    delete plainUser.refreshTokenHash;
    return plainUser as User;
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: this.jwtConfig.refreshCookieMaxAge,
      path: '/',
    });
  }

  private get jwtConfig(): JwtConfig {
    return this.configService.getOrThrow<JwtConfig>('jwt', { infer: true });
  }
}
