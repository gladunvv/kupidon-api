import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { createHash, randomInt } from 'crypto';
import { ERROR_CODES } from '../core/http/error-codes';

const ISSUE_OTP_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then return -1 end
local phoneCount = redis.call('INCR', KEYS[2])
if phoneCount == 1 then redis.call('EXPIRE', KEYS[2], ARGV[3]) end
local ipCount = redis.call('INCR', KEYS[3])
if ipCount == 1 then redis.call('EXPIRE', KEYS[3], ARGV[3]) end
if phoneCount > tonumber(ARGV[4]) or ipCount > tonumber(ARGV[5]) then return -2 end
redis.call('SET', KEYS[1], '1', 'EX', ARGV[2])
redis.call('SET', KEYS[4], ARGV[6], 'EX', ARGV[1])
redis.call('DEL', KEYS[5], KEYS[6])
return 1
`;

const VALIDATE_OTP_SCRIPT = `
if redis.call('EXISTS', KEYS[3]) == 1 then return -2 end
local storedOtp = redis.call('GET', KEYS[1])
if not storedOtp then return 0 end
if storedOtp == ARGV[1] then
  redis.call('DEL', KEYS[1], KEYS[2], KEYS[3])
  return 1
end
local attempts = redis.call('INCR', KEYS[2])
if attempts == 1 then redis.call('EXPIRE', KEYS[2], ARGV[2]) end
if attempts >= tonumber(ARGV[3]) then
  redis.call('DEL', KEYS[1], KEYS[2])
  redis.call('SET', KEYS[3], '1', 'EX', ARGV[4])
  return -1
end
return 0
`;

@Injectable()
export class OtpService {
  private readonly redis: Redis;
  private readonly ttlSeconds: number;
  private readonly otpLength: number;
  private readonly cooldownSeconds: number;
  private readonly requestWindowSeconds: number;
  private readonly maxRequestsPerWindow: number;
  private readonly maxRequestsPerIpWindow: number;
  private readonly maxVerifyAttempts: number;
  private readonly blockSeconds: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.redis = this.redisService.getOrThrow();
    this.ttlSeconds = this.configService.getOrThrow<number>('otp.ttlSeconds');
    this.otpLength = this.configService.getOrThrow<number>('otp.length');
    this.cooldownSeconds = this.configService.get<number>(
      'otp.cooldownSeconds',
      60,
    );
    this.requestWindowSeconds = this.configService.get<number>(
      'otp.requestWindowSeconds',
      3600,
    );
    this.maxRequestsPerWindow = this.configService.get<number>(
      'otp.maxRequestsPerWindow',
      5,
    );
    this.maxRequestsPerIpWindow = this.configService.get<number>(
      'otp.maxRequestsPerIpWindow',
      30,
    );
    this.maxVerifyAttempts = this.configService.get<number>(
      'otp.maxVerifyAttempts',
      5,
    );
    this.blockSeconds = this.configService.get<number>('otp.blockSeconds', 900);
  }

  async generateOtp(phoneNumber: string, clientIp: string): Promise<string> {
    const otp = this.createOtp();
    const phoneKey = this.hashIdentifier(phoneNumber);
    const ipKey = this.hashIdentifier(clientIp);
    const result = Number(
      await this.redis.eval(
        ISSUE_OTP_SCRIPT,
        6,
        `otp:cooldown:${phoneKey}`,
        `otp:requests:phone:${phoneKey}`,
        `otp:requests:ip:${ipKey}`,
        `otp:code:${phoneKey}`,
        `otp:attempts:${phoneKey}`,
        `otp:blocked:${phoneKey}`,
        this.ttlSeconds,
        this.cooldownSeconds,
        this.requestWindowSeconds,
        this.maxRequestsPerWindow,
        this.maxRequestsPerIpWindow,
        otp,
      ),
    );

    if (result !== 1) {
      throw new HttpException(
        {
          message: 'Too many OTP requests. Please try again later',
          code: ERROR_CODES.TOO_MANY_OTP_REQUESTS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return otp;
  }

  async sendOtp(_phoneNumber: string, _otp: string): Promise<void> {
    return;
  }

  async validateOtp(phoneNumber: string, otp: string): Promise<boolean> {
    const phoneKey = this.hashIdentifier(phoneNumber);
    const result = Number(
      await this.redis.eval(
        VALIDATE_OTP_SCRIPT,
        3,
        `otp:code:${phoneKey}`,
        `otp:attempts:${phoneKey}`,
        `otp:blocked:${phoneKey}`,
        otp,
        this.ttlSeconds,
        this.maxVerifyAttempts,
        this.blockSeconds,
      ),
    );

    if (result === -1 || result === -2) {
      throw new HttpException(
        {
          message: 'Too many invalid OTP attempts. Please try again later',
          code: ERROR_CODES.OTP_ATTEMPTS_EXCEEDED,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return result === 1;
  }

  private createOtp(): string {
    const min = 10 ** (this.otpLength - 1);
    const max = 10 ** this.otpLength;
    return randomInt(min, max).toString();
  }

  private hashIdentifier(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
