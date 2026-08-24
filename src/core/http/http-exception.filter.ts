import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiResponse } from '../types/api-response.interface';
import { ERROR_CODES } from './error-codes';
import { getRequestId } from '../logging/request-context';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const requestId = getRequestId();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode: string = ERROR_CODES.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown> & {
          message?: string | string[] | Record<string, string>;
          error?: string;
          code?: string;
        };
        if (typeof responseObj.message === 'string') {
          message = responseObj.message;
        } else if (Array.isArray(responseObj.message)) {
          message = responseObj.message.join(', ');
        } else if (typeof responseObj.message === 'object') {
          message = Object.values(responseObj.message).join(', ');
        } else if (typeof responseObj.error === 'string') {
          message = responseObj.error;
        }

        if (typeof responseObj.code === 'string') {
          errorCode = responseObj.code;
        }
      }

      if (errorCode === ERROR_CODES.INTERNAL_SERVER_ERROR) {
        errorCode = this.getErrorCodeForStatus(status);
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      message = 'Internal server error';
      errorCode = ERROR_CODES.INTERNAL_SERVER_ERROR;
    }

    const errorResponse: ApiResponse = {
      success: false,
      message,
      error: {
        code: errorCode,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    if (status >= 500) {
      const errorMessage =
        exception instanceof Error ? exception.message : String(exception);
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`Unhandled HTTP exception: ${errorMessage}`, stack);
    }

    response.status(status).json(errorResponse);
  }

  private getErrorCodeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      default:
        return ERROR_CODES.INTERNAL_SERVER_ERROR;
    }
  }
}
