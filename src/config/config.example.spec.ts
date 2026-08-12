import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import ms from 'ms';
import { validateConfig } from './validate-config';

describe('config.example.yaml', () => {
  it('is a complete valid local configuration', () => {
    const filePath = join(process.cwd(), 'config.example.yaml');
    const rawConfig = yaml.load(readFileSync(filePath, 'utf8')) as Record<
      string,
      any
    >;
    rawConfig.jwt.refreshCookieMaxAge = ms(rawConfig.jwt.refreshExpiresIn);

    const config = validateConfig(rawConfig);

    expect(config.app.port).toBe(8000);
    expect(config.mongodb.uri).toBe('mongodb://127.0.0.1:27017/datingapp');
    expect(config.redis.url).toBe('redis://127.0.0.1:6379');
    expect(config.jwt.refreshCookieMaxAge).toBe(7 * 24 * 60 * 60 * 1000);
    expect(config.otp).toEqual(
      expect.objectContaining({
        ttlSeconds: 300,
        length: 4,
        cooldownSeconds: 60,
        maxRequestsPerWindow: 5,
        maxRequestsPerIpWindow: 30,
        maxVerifyAttempts: 5,
        blockSeconds: 900,
      }),
    );
  });
});
