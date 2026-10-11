import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import ms from 'ms';
import { validateConfig } from './validate-config';

function baseConfig(): Record<string, any> {
  const raw = yaml.load(
    readFileSync(join(process.cwd(), 'config.example.yaml'), 'utf8'),
  ) as Record<string, any>;
  raw.jwt.refreshCookieMaxAge = ms(raw.jwt.refreshExpiresIn);
  return raw;
}

describe('validateConfig jwt secrets', () => {
  it('rejects a secret shorter than 32 characters', () => {
    const config = baseConfig();
    config.jwt.secret = 'too-short';

    expect(() => validateConfig(config)).toThrow(/jwt.secret/);
  });

  it('rejects one secret reused for access and refresh tokens', () => {
    const config = baseConfig();
    config.jwt.secret_refresh = config.jwt.secret;

    expect(() => validateConfig(config)).toThrow(
      /jwt.secret_refresh: must differ/,
    );
  });

  it('accepts two distinct long secrets', () => {
    expect(() => validateConfig(baseConfig())).not.toThrow();
  });
});

describe('validateConfig otp.devFixedCode', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('accepts a digit code outside production', () => {
    process.env.NODE_ENV = 'development';
    const config = baseConfig();
    config.otp.devFixedCode = '0000';

    expect(() => validateConfig(config)).not.toThrow();
  });

  it('refuses any fixed code under NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    const config = baseConfig();
    config.otp.devFixedCode = '0000';

    expect(() => validateConfig(config)).toThrow(
      /otp.devFixedCode: not allowed when NODE_ENV=production/,
    );
  });

  it('rejects a non-numeric code', () => {
    process.env.NODE_ENV = 'development';
    const config = baseConfig();
    config.otp.devFixedCode = 'abcd';

    expect(() => validateConfig(config)).toThrow(/otp.devFixedCode/);
  });
});
