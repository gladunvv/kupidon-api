import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiResponse } from '../types/api-response.interface';
import { ERROR_CODES } from '../utils/response.helper';
import { v4 as uuidv4 } from 'uuid';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const requestId = request.headers['x-request-id'] || uuidv4();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode: string = ERROR_CODES.INTERNAL_SERVER_ERROR;
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown> & {
          message?: string | string[];
          error?: string;
          details?: unknown;
        };
        message =
          (responseObj.message as string) || responseObj.error || message;
        details = responseObj.details ?? responseObj;

        switch (status) {
          case HttpStatus.UNAUTHORIZED:
            errorCode = ERROR_CODES.UNAUTHORIZED;
            break;
          case HttpStatus.FORBIDDEN:
            errorCode = ERROR_CODES.FORBIDDEN;
            break;
          case HttpStatus.NOT_FOUND:
            errorCode = ERROR_CODES.NOT_FOUND;
            break;
          case HttpStatus.BAD_REQUEST:
            errorCode = ERROR_CODES.BAD_REQUEST;
            break;
          default:
            errorCode = ERROR_CODES.INTERNAL_SERVER_ERROR;
        }
      }
    }

    if (Array.isArray(message)) {
      details = message;
      message = 'Validation failed';
      errorCode = ERROR_CODES.VALIDATION_ERROR;
    }

    const errorResponse: ApiResponse = {
      success: false,
      message,
      error: {
        code: errorCode,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    if (status >= 500) {
      console.error('Server Error:', {
        requestId,
        error: exception,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    response.status(status).json(errorResponse);
  }
}
