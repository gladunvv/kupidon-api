import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Public } from '../core/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@Controller()
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    @InjectConnection() private readonly mongoConnection: Connection,
    private readonly redisService: RedisService,
  ) {}

  // Prometheus-format metrics for scraping. Bypasses the global response
  // envelope (@Res with no passthrough) since scrapers expect the raw
  // text/plain exposition format, not JSON.
  @Public()
  @Get('metrics')
  async getMetrics(@Res() res: Response): Promise<void> {
    this.metricsService.mongoConnected.set(
      this.mongoConnection.readyState === 1 ? 1 : 0,
    );
    this.metricsService.redisConnected.set(
      this.redisService.getOrThrow().status === 'ready' ? 1 : 0,
    );

    res.setHeader('Content-Type', this.metricsService.registry.contentType);
    res.send(await this.metricsService.registry.metrics());
  }
}
