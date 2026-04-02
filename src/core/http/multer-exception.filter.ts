import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { ERROR_CODES } from './error-codes';
import { ApiResponse } from '../types/api-response.interface';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const requestId =
      request.requestId || request.headers['x-request-id'] || uuidv4();

    let message = 'File upload error';
    let errorCode: string = ERROR_CODES.BAD_REQUEST;

    switch (exception.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large. Maximum size is 5MB';
        errorCode = ERROR_CODES.FILE_TOO_LARGE;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        errorCode = ERROR_CODES.TOO_MANY_FILES;
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected field name';
        errorCode = ERROR_CODES.UNEXPECTED_FILE;
        break;
      default:
        message = exception.message || 'File upload error';
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

    response.status(HttpStatus.BAD_REQUEST).json(errorResponse);
  }
}
