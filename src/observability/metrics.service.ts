import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'path', 'status'] as const,
    registers: [this.registry],
  });

  readonly httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'path', 'status'] as const,
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [this.registry],
  });

  readonly mongoConnected = new Gauge({
    name: 'mongodb_connected',
    help: '1 if the MongoDB connection is ready, 0 otherwise',
    registers: [this.registry],
  });

  readonly redisConnected = new Gauge({
    name: 'redis_connected',
    help: '1 if the Redis connection is ready, 0 otherwise',
    registers: [this.registry],
  });

  readonly websocketConnections = new Gauge({
    name: 'websocket_connections',
    help: 'Number of currently active WebSocket connections',
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  recordHttpRequest(
    method: string,
    path: string,
    status: number,
    durationSeconds: number,
  ): void {
    const labels = { method, path, status: String(status) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationSeconds);
  }
}
