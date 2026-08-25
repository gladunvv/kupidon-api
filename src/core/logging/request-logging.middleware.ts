import { Injectable, Logger, NestMiddleware, Optional } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runWithRequestId } from './request-context';
import { MetricsService } from '../../observability/metrics.service';

const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(@Optional() private readonly metricsService?: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const requestId =
      (req.headers[REQUEST_ID_HEADER] as string | undefined) || uuidv4();
    res.setHeader('X-Request-Id', requestId);

    runWithRequestId(requestId, () => {
      const startedAt = Date.now();

      res.on('finish', () => {
        const durationMs = Date.now() - startedAt;

        this.logger.log({
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs,
        });

        // Route pattern (e.g. "/match/:matchId"), not the raw URL — using
        // originalUrl as a metric label would blow up cardinality with
        // every distinct id that ever appears in a path.
        const routePath = req.route?.path ?? 'unmatched';
        this.metricsService?.recordHttpRequest(
          req.method,
          routePath,
          res.statusCode,
          durationMs / 1000,
        );
      });

      next();
    });
  }
}
