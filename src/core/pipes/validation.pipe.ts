import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export const exceptionFactory = (errors: ValidationError[]) => {
  const message: Record<string, string> = {};
  errors.forEach(
    ({ property, constraints }) =>
      (message[property] = Object.values(constraints)?.[0]),
  );

  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message,
  });
};

// whitelist + forbidNonWhitelisted: a DTO is the full contract of a request
// body/query. Without them any extra key reaches the service layer, and an
// update built from a spread DTO writes whatever the client sent — see
// docs/security-review.md (REL-02, mass assignment).
export const validationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  enableDebugMessages: false,
  exceptionFactory,
});
