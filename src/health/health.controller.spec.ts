import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ShutdownService } from './shutdown.service';

describe('HealthController', () => {
  const makeController = (
    mongoReadyState: number,
    redisStatus: string,
    shuttingDown = false,
  ) => {
    const mongoConnection = { readyState: mongoReadyState };
    const redisService = {
      getOrThrow: () => ({ status: redisStatus }),
    };
    const shutdownService = new ShutdownService();
    if (shuttingDown) shutdownService.beginShutdown();

    return new HealthController(
      mongoConnection as never,
      redisService as never,
      shutdownService,
    );
  };

  describe('live', () => {
    it('always reports ok regardless of dependency state', () => {
      const controller = makeController(0, 'end');

      expect(controller.live()).toEqual({ status: 'ok' });
    });
  });

  describe('ready', () => {
    it('reports ok when mongo and redis are both connected', () => {
      const controller = makeController(1, 'ready');

      expect(controller.ready()).toEqual({
        status: 'ok',
        mongo: 'up',
        redis: 'up',
      });
    });

    it('rejects with details when mongo is down', () => {
      const controller = makeController(0, 'ready');

      expect(() => controller.ready()).toThrow(ServiceUnavailableException);
      try {
        controller.ready();
      } catch (error) {
        expect((error as ServiceUnavailableException).getResponse()).toEqual({
          status: 'not_ready',
          mongo: 'down',
          redis: 'up',
        });
      }
    });

    it('rejects with details when redis is down', () => {
      const controller = makeController(1, 'connecting');

      expect(() => controller.ready()).toThrow(ServiceUnavailableException);
      try {
        controller.ready();
      } catch (error) {
        expect((error as ServiceUnavailableException).getResponse()).toEqual({
          status: 'not_ready',
          mongo: 'up',
          redis: 'down',
        });
      }
    });

    it('rejects once shutdown has begun, even with healthy dependencies', () => {
      const controller = makeController(1, 'ready', true);

      expect(() => controller.ready()).toThrow(ServiceUnavailableException);
      try {
        controller.ready();
      } catch (error) {
        expect((error as ServiceUnavailableException).getResponse()).toEqual({
          status: 'shutting_down',
        });
      }
    });
  });
});
