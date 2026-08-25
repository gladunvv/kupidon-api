import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  const makeRes = () => ({
    setHeader: jest.fn(),
    send: jest.fn(),
  });

  it('reports mongo and redis as up and returns Prometheus text output', async () => {
    const metricsService = new MetricsService();
    const mongoConnection = { readyState: 1 };
    const redisService = { getOrThrow: () => ({ status: 'ready' }) };
    const controller = new MetricsController(
      metricsService,
      mongoConnection as never,
      redisService as never,
    );
    const res = makeRes();

    await controller.getMetrics(res as never);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      metricsService.registry.contentType,
    );
    const body = res.send.mock.calls[0][0] as string;
    expect(body).toContain('mongodb_connected 1');
    expect(body).toContain('redis_connected 1');
  });

  it('reports mongo and redis as down when disconnected', async () => {
    const metricsService = new MetricsService();
    const mongoConnection = { readyState: 0 };
    const redisService = { getOrThrow: () => ({ status: 'connecting' }) };
    const controller = new MetricsController(
      metricsService,
      mongoConnection as never,
      redisService as never,
    );
    const res = makeRes();

    await controller.getMetrics(res as never);

    const body = res.send.mock.calls[0][0] as string;
    expect(body).toContain('mongodb_connected 0');
    expect(body).toContain('redis_connected 0');
  });
});
