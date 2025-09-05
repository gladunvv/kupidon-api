import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RedisService } from '@liaoliaots/nestjs-redis';

@Injectable()
export class OtpService {
  private readonly redis: Redis | null;

  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getOrThrow();
  }

  async generateOtp(phoneNumber: string): Promise<string> {
    // const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // mock
    const otp = '4444';
    const key = `otp:${phoneNumber}`;
    await this.redis.set(key, otp, 'EX', 300); // OTP действует 5 минут
    return otp;
  }

  async sendOtp(phoneNumber: string, otp: string): Promise<void> {
    // Здесь можно интегрировать сервис SMS-уведомлений (например, Twilio, Firebase, SMS.ru и т. д.)
    console.log(`Отправка OTP-кода ${otp} на номер ${phoneNumber}`);
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
}
