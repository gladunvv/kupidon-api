import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runWithRequestId } from './request-context';

const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const requestId =
      (req.headers[REQUEST_ID_HEADER] as string | undefined) || uuidv4();
    res.setHeader('X-Request-Id', requestId);

    runWithRequestId(requestId, () => {
      const startedAt = Date.now();

      res.on('finish', () => {
        this.logger.log({
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Date.now() - startedAt,
        });
      });

      next();
    });
  }
}
