import { Controller, Post, Body, Res, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Public } from '../core/decorators/public.decorator';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequestOtpDto } from './dto/request-otp.dto';
import { ResponseMessage } from 'src/core/decorators/response-message.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @ApiOperation({ summary: 'Request OTP by phone number' })
  @ResponseMessage('OTP sent successfully')
  @Post('request-otp')
  async requestOtp(@Body() dto: RequestOtpDto) {
    return await this.authService.sendOtp(dto.phone);
  }

  @Public()
  @ApiOperation({ summary: 'Verify OTP and get access token' })
  @ResponseMessage('OTP verified successfully')
  @Post('verify-otp')
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.authService.verifyOtp(dto, res);
  }

  @Public()
  @ApiOperation({ summary: 'Refresh access token by cookie' })
  @ApiCookieAuth('refresh_token')
  @ResponseMessage('Token refreshed successfully')
  @Post('refresh-token')
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;
    return this.authService.refreshToken(refreshToken, res);
  }

  @Public()
  @ApiOperation({ summary: 'Clear refresh token cookie' })
  @ResponseMessage('Token cleared successfully')
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res);
  }
}
