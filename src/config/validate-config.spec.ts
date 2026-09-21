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
