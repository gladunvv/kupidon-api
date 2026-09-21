import { plainToInstance } from 'class-transformer';
import { ValidationError, validateSync } from 'class-validator';
import { RootConfig } from './config.schema';

function flattenErrors(errors: ValidationError[], parentPath = ''): string[] {
  const result: string[] = [];

  for (const error of errors) {
    const currentPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        result.push(`${currentPath}: ${message}`);
      }
    }

    if (error.children?.length) {
      result.push(...flattenErrors(error.children, currentPath));
    }
  }

  return result;
}

export function validateConfig(rawConfig: unknown): RootConfig {
  const config = plainToInstance(RootConfig, rawConfig);

  const errors = validateSync(config, {
    skipMissingProperties: false,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  const messages = flattenErrors(errors);

  // Cross-field rule, so it doesn't fit a property decorator: one shared
  // secret would make a refresh token a valid access token as well.
  if (config.jwt?.secret && config.jwt.secret === config.jwt.secret_refresh) {
    messages.push('jwt.secret_refresh: must differ from jwt.secret');
  }

  if (messages.length > 0) {
    throw new Error(
      `Configuration validation failed:\n- ${messages.join('\n- ')}`,
    );
  }

  return config;
}
