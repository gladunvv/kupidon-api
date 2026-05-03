import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { randomInt } from 'crypto';

@Injectable()
export class OtpService {
  private readonly redis: Redis | null;
  private readonly ttlSeconds: number;
  private readonly otpLength: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.redis = this.redisService.getOrThrow();
    this.ttlSeconds = this.configService.getOrThrow<number>('otp.ttlSeconds');
    this.otpLength = this.configService.getOrThrow<number>('otp.length');
  }

  async generateOtp(phoneNumber: string): Promise<string> {
    const otp = this.createOtp();
    const key = `otp:${phoneNumber}`;
    await this.redis.set(key, otp, 'EX', this.ttlSeconds);
    return otp;
  }

  async sendOtp(phoneNumber: string, otp: string): Promise<void> {
    console.log(`Sending OTP ${otp} to ${phoneNumber}`);
  }

  async validateOtp(phoneNumber: string, otp: string): Promise<boolean> {
    const key = `otp:${phoneNumber}`;
    const storedOtp = await this.redis.get(key);
    if (storedOtp === otp) {
      await this.redis.del(key);
      return true;
    }
    return false;
  }

  private createOtp(): string {
    const min = 10 ** (this.otpLength - 1);
    const max = 10 ** this.otpLength;
    return randomInt(min, max).toString();
  }
}
