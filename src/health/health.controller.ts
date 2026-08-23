import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Public } from '../core/decorators/public.decorator';
import { ShutdownService } from './shutdown.service';

@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    private readonly redisService: RedisService,
    private readonly shutdownService: ShutdownService,
  ) {}

  // Liveness: is the process itself still running. No dependency checks —
  // an orchestrator uses this to decide whether to restart the container.
  @Public()
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  // Readiness: can this instance currently serve traffic. An orchestrator
  // uses this to decide whether to route requests to the instance.
  @Public()
  @Get('ready')
  ready() {
    if (this.shutdownService.isShuttingDown) {
      throw new ServiceUnavailableException({ status: 'shutting_down' });
    }

    const mongoUp = this.mongoConnection.readyState === 1;
    const redisUp = this.redisService.getOrThrow().status === 'ready';

    if (!mongoUp || !redisUp) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        mongo: mongoUp ? 'up' : 'down',
        redis: redisUp ? 'up' : 'down',
      });
    }

    return { status: 'ok', mongo: 'up', redis: 'up' };
  }
}
