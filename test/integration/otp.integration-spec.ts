import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { OtpService } from '../../src/otp/otp.service';
import { createTestRedis } from './support/redis';
import { integrationConfig } from './support/config';

describe('OtpService (real Redis)', () => {
  let redis: Redis;
  let service: OtpService;

  beforeAll(() => {
    redis = createTestRedis();
    const redisService = { getOrThrow: () => redis } as never;
    const otpConfig = integrationConfig.otp;
    const configService = {
      getOrThrow: (key: string) => {
        if (key === 'otp.ttlSeconds') return otpConfig.ttlSeconds;
        if (key === 'otp.length') return otpConfig.length;
        throw new Error(`Unknown config key: ${key}`);
      },
      get: (key: string, fallback: number) => {
        const map: Record<string, number> = {
          'otp.cooldownSeconds': otpConfig.cooldownSeconds,
          'otp.requestWindowSeconds': otpConfig.requestWindowSeconds,
          'otp.maxRequestsPerWindow': otpConfig.maxRequestsPerWindow,
          'otp.maxRequestsPerIpWindow': otpConfig.maxRequestsPerIpWindow,
          'otp.maxVerifyAttempts': otpConfig.maxVerifyAttempts,
          'otp.blockSeconds': otpConfig.blockSeconds,
        };
        return map[key] ?? fallback;
      },
    } as unknown as ConfigService;

    service = new OtpService(redisService, configService);
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.flushdb();
    await redis.quit();
  });

  it('accepts a freshly issued OTP exactly once', async () => {
    const phone = '+79990001122';
    const otp = await service.generateOtp(phone, '203.0.113.10');

    await expect(service.validateOtp(phone, otp)).resolves.toBe(true);
    await expect(service.validateOtp(phone, otp)).resolves.toBe(false);
  });

  it('rejects the OTP once its TTL has elapsed', async () => {
    const phone = '+79990001133';
    const otp = await service.generateOtp(phone, '203.0.113.11');

    await new Promise((resolve) =>
      setTimeout(resolve, (integrationConfig.otp.ttlSeconds + 1) * 1000),
    );

    await expect(service.validateOtp(phone, otp)).resolves.toBe(false);
  }, 10000);

  it('blocks further requests once the per-phone window limit is exceeded', async () => {
    const phone = '+79990001144';
    const { cooldownSeconds, maxRequestsPerWindow } = integrationConfig.otp;

    for (let i = 0; i < maxRequestsPerWindow; i += 1) {
      await expect(
        service.generateOtp(phone, `203.0.113.${20 + i}`),
      ).resolves.toEqual(expect.any(String));
      await new Promise((resolve) =>
        setTimeout(resolve, (cooldownSeconds + 0.2) * 1000),
      );
    }

    await expect(
      service.generateOtp(phone, '203.0.113.30'),
    ).rejects.toMatchObject({ status: 429 });
  }, 15000);

  it('blocks verification after too many invalid attempts', async () => {
    const phone = '+79990001155';
    const { maxVerifyAttempts } = integrationConfig.otp;
    await service.generateOtp(phone, '203.0.113.40');

    for (let i = 0; i < maxVerifyAttempts - 1; i += 1) {
      await expect(service.validateOtp(phone, '0000')).resolves.toBe(false);
    }

    await expect(service.validateOtp(phone, '0000')).rejects.toMatchObject({
      status: 429,
    });
  });
});
