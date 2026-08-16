import Redis from 'ioredis';

export const INTEGRATION_REDIS_URL =
  process.env.INTEGRATION_REDIS_URL ?? 'redis://127.0.0.1:6379/15';

export function createTestRedis(): Redis {
  return new Redis(INTEGRATION_REDIS_URL);
}
