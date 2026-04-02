import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../types/api-response.interface';
import { v4 as uuidv4 } from 'uuid';
import { Reflector } from '@nestjs/core';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.headers['x-request-id'] || uuidv4();
    const defaultMessage =
      this.reflector.get(RESPONSE_MESSAGE_KEY, context.getHandler()) ??
      'Operation completed successfully';

    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'success' in data) {
          return {
            ...data,
            meta: {
              timestamp: new Date().toISOString(),
              requestId,
              ...data.meta,
            },
          };
        }

        return {
          success: true,
          message: defaultMessage,
          data,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: requestId,
          },
        };
      }),
    );
  }
}
