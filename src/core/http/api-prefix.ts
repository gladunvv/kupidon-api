import { INestApplication, RequestMethod } from '@nestjs/common';

// Kept out of the versioned surface: infra probes/scrapers hit these by a
// fixed, documented path (docker-compose healthcheck, Prometheus scrape
// config) and aren't part of the product API contract that gets versioned.
export const API_PREFIX = 'v1';

export function configureGlobalPrefix(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [
      { path: 'health/(.*)', method: RequestMethod.ALL },
      { path: 'metrics', method: RequestMethod.ALL },
    ],
  });
}
