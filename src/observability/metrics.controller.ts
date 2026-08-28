import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { Public } from '../core/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@Controller()
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
    @InjectConnection() private readonly mongoConnection: Connection,
    private readonly redisService: RedisService,
  ) {}

  // Prometheus-format metrics for scraping. Bypasses the global response
  // envelope (@Res with no passthrough) since scrapers expect the raw
  // text/plain exposition format, not JSON.
  //
  // Optionally gated by metrics.token in config.yaml: unset (the default
  // for local dev/compose) leaves the endpoint open, since it's the only
  // way Prometheus can scrape it without extra wiring; set it in any
  // deployment reachable from outside a trusted network.
  @Public()
  @Get('metrics')
  async getMetrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    const requiredToken = this.configService.get<string>('metrics.token');
    if (requiredToken && !this.hasValidToken(req, requiredToken)) {
      res.status(401).send('Unauthorized');
      return;
    }

    this.metricsService.mongoConnected.set(
      this.mongoConnection.readyState === 1 ? 1 : 0,
    );
    this.metricsService.redisConnected.set(
      this.redisService.getOrThrow().status === 'ready' ? 1 : 0,
    );

    res.setHeader('Content-Type', this.metricsService.registry.contentType);
    res.send(await this.metricsService.registry.metrics());
  }

  private hasValidToken(req: Request, requiredToken: string): boolean {
    const header = req.headers.authorization;
    const provided = header?.startsWith('Bearer ') ? header.slice(7) : '';

    const providedHash = createHash('sha256').update(provided).digest();
    const requiredHash = createHash('sha256').update(requiredToken).digest();

    return timingSafeEqual(providedHash, requiredHash);
  }
}
