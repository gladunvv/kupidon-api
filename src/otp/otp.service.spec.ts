import { HttpStatus } from '@nestjs/common';
import { OtpService } from './otp.service';

describe('OtpService abuse protection', () => {
  const phone = '+79990001122';
  const clientIp = '203.0.113.10';

  const createService = (...evalResults: number[]) => {
    const redis = {
      eval: jest.fn(),
    };
    for (const result of evalResults) {
      redis.eval.mockResolvedValueOnce(result);
    }
    const redisService = { getOrThrow: jest.fn().mockReturnValue(redis) };
    const configService = {
      getOrThrow: jest.fn((key: string) =>
        key === 'otp.ttlSeconds' ? 300 : 4,
      ),
      get: jest.fn((_key: string, fallback: number) => fallback),
    };

    return {
      redis,
      service: new OtpService(redisService as never, configService as never),
    };
  };

  it('issues an OTP through one atomic Redis operation without exposing identifiers in keys', async () => {
    const { redis, service } = createService(1);

    const otp = await service.generateOtp(phone, clientIp);

    expect(otp).toMatch(/^\d{4}$/);
    expect(redis.eval).toHaveBeenCalledTimes(1);
    const command = JSON.stringify(redis.eval.mock.calls[0]);
    expect(command).not.toContain(phone);
    expect(command).not.toContain(clientIp);
  });

  it.each([-1, -2])(
    'rejects request limit result %s with HTTP 429',
    async (result) => {
      const { service } = createService(result);

      await expect(service.generateOtp(phone, clientIp)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    },
  );

  it('accepts the OTP once and treats missing or invalid codes as invalid', async () => {
    const { service } = createService(1, 0, 0);

    await expect(service.validateOtp(phone, '1234')).resolves.toBe(true);
    await expect(service.validateOtp(phone, '1234')).resolves.toBe(false);
    await expect(service.validateOtp(phone, '0000')).resolves.toBe(false);
  });

  it.each([-1, -2])(
    'blocks verification after attempt limit result %s',
    async (result) => {
      const { service } = createService(result);

      await expect(service.validateOtp(phone, '0000')).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
        response: expect.objectContaining({
          code: 'OTP_ATTEMPTS_EXCEEDED',
        }),
      });
    },
  );

  it('does not log the OTP or phone in the delivery placeholder', async () => {
    const { service } = createService();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await service.sendOtp(phone, '1234');

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
