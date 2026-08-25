import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../types/api-response.interface';
import { Reflector } from '@nestjs/core';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';
import { getRequestId } from '../logging/request-context';

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
    const requestId = getRequestId();
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
          meta: { timestamp: new Date().toISOString(), requestId: requestId },
        };
      }),
    );
  }
}
