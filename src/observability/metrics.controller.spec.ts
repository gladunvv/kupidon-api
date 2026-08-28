import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  const makeRes = () => ({
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  });

  const makeReq = (bearerToken?: string) => ({
    headers: bearerToken
      ? { authorization: `Bearer ${bearerToken}` }
      : ({} as Record<string, string>),
  });

  const makeController = (
    configuredToken: string | undefined,
    mongoReadyState = 1,
    redisStatus = 'ready',
  ) => {
    const metricsService = new MetricsService();
    const configService = { get: () => configuredToken };
    const mongoConnection = { readyState: mongoReadyState };
    const redisService = { getOrThrow: () => ({ status: redisStatus }) };

    return new MetricsController(
      metricsService,
      configService as never,
      mongoConnection as never,
      redisService as never,
    );
  };

  it('reports mongo and redis as up and returns Prometheus text output when no token is configured', async () => {
    const controller = makeController(undefined);
    const res = makeRes();

    await controller.getMetrics(makeReq() as never, res as never);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      expect.any(String),
    );
    const body = res.send.mock.calls[0][0] as string;
    expect(body).toContain('mongodb_connected 1');
    expect(body).toContain('redis_connected 1');
  });

  it('reports mongo and redis as down when disconnected', async () => {
    const controller = makeController(undefined, 0, 'connecting');
    const res = makeRes();

    await controller.getMetrics(makeReq() as never, res as never);

    const body = res.send.mock.calls[0][0] as string;
    expect(body).toContain('mongodb_connected 0');
    expect(body).toContain('redis_connected 0');
  });

  describe('when metrics.token is configured', () => {
    it('rejects requests without a bearer token', async () => {
      const controller = makeController('secret-token');
      const res = makeRes();

      await controller.getMetrics(makeReq() as never, res as never);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith('Unauthorized');
    });

    it('rejects requests with the wrong bearer token', async () => {
      const controller = makeController('secret-token');
      const res = makeRes();

      await controller.getMetrics(
        makeReq('wrong-token') as never,
        res as never,
      );

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('serves metrics when the bearer token matches', async () => {
      const controller = makeController('secret-token');
      const res = makeRes();

      await controller.getMetrics(
        makeReq('secret-token') as never,
        res as never,
      );

      expect(res.status).not.toHaveBeenCalled();
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('mongodb_connected'),
      );
    });
  });
});
