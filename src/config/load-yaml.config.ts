import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import ms from 'ms';
import { validateConfig } from './validate-config';

export default () => {
  const filePath = join(process.cwd(), 'config.yaml');

  if (!existsSync(filePath)) {
    throw new Error(`Configuration file not found: ${filePath}`);
  }

  const rawFile = readFileSync(filePath, 'utf8');
  const parsed = yaml.load(rawFile) as Record<string, any>;

  if (parsed?.jwt?.refreshExpiresIn) {
    parsed.jwt.refreshCookieMaxAge = ms(parsed.jwt.refreshExpiresIn);
  }

  return validateConfig(parsed);
};
