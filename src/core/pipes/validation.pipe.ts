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

export const validationPipe = new ValidationPipe({
  transform: true,
  enableDebugMessages: true,
  exceptionFactory,
});
