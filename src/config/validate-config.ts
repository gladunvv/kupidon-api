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

  if (errors.length > 0) {
    const messages = flattenErrors(errors);
    throw new Error(
      `Configuration validation failed:\n- ${messages.join('\n- ')}`,
    );
  }

  return config;
}
