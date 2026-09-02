import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

export class WsValidationError extends Error {}

// Kept separate from the app's HTTP ValidationPipe on purpose: Nest's
// default WS exception handling just logs a pipe's thrown exception and
// sends the client nothing back. Validating inline lets every gateway
// handler report failures through the same try/catch -> chat_error path
// it already uses for every other error.
export function validateWsPayload<T extends object>(
  dtoClass: new () => T,
  data: unknown,
): T {
  const instance = plainToInstance(dtoClass, data ?? {});
  const errors = validateSync(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    const details = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    throw new WsValidationError(details.join('; ') || 'Invalid payload');
  }

  return instance;
}
