import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';
import { ResponseHelper, ERROR_CODES } from '../utils/response.helper';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let message = 'File upload error';
    let status = HttpStatus.BAD_REQUEST;
    let errorCode: string = ERROR_CODES.BAD_REQUEST;

    switch (exception.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large. Maximum size is 5MB';
        errorCode = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        errorCode = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected field name';
        errorCode = 'UNEXPECTED_FIELD';
        break;
      default:
        message = exception.message || 'File upload error';
    }

    const errorResponse = ResponseHelper.error(message, errorCode);

    response.status(status).json({
      ...errorResponse,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'multer-error',
      },
    });
  }
}