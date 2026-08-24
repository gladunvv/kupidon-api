import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';
import { ERROR_CODES } from './error-codes';
import { ApiResponse } from '../types/api-response.interface';
import { getRequestId } from '../logging/request-context';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const requestId = getRequestId();

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
        message = 'File upload error';
    }

    const errorResponse: ApiResponse = {
      success: false,
      message,
      error: { code: errorCode },
      meta: { timestamp: new Date().toISOString(), requestId },
    };

    response.status(HttpStatus.BAD_REQUEST).json(errorResponse);
  }
}
