import { EventEmitter } from 'events';
import { RequestLoggingMiddleware } from './request-logging.middleware';
import { getRequestId } from './request-context';
import { MetricsService } from '../../observability/metrics.service';

describe('RequestLoggingMiddleware', () => {
  const makeRes = () => {
    const res = new EventEmitter() as any;
    res.setHeader = jest.fn();
    res.statusCode = 200;
    return res;
  };

  it('generates a request id, exposes it via the response header, and makes it available downstream', () => {
    const middleware = new RequestLoggingMiddleware();
    const req = { headers: {}, method: 'GET', originalUrl: '/match' } as any;
    const res = makeRes();
    let idSeenByNext: string | undefined;

    middleware.use(req, res, () => {
      idSeenByNext = getRequestId();
    });

    expect(idSeenByNext).toEqual(expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', idSeenByNext);
  });

  it('reuses an incoming x-request-id header instead of generating a new one', () => {
    const middleware = new RequestLoggingMiddleware();
    const req = {
      headers: { 'x-request-id': 'client-supplied-id' },
      method: 'GET',
      originalUrl: '/match',
    } as any;
    const res = makeRes();

    middleware.use(req, res, () => {
      expect(getRequestId()).toBe('client-supplied-id');
    });

    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      'client-supplied-id',
    );
  });

  it('logs one access line with method, path and status once the response finishes', () => {
    const middleware = new RequestLoggingMiddleware();
    const req = {
      headers: {},
      method: 'POST',
      originalUrl: '/auth/verify-otp',
    } as any;
    const res = makeRes();
    res.statusCode = 201;
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);

    middleware.use(req, res, () => {});
    expect(stdoutSpy).not.toHaveBeenCalled();

    res.emit('finish');

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const written = stdoutSpy.mock.calls[0][0] as string;
    expect(written).toContain('POST');
    expect(written).toContain('/auth/verify-otp');
    expect(written).toContain('201');

    stdoutSpy.mockRestore();
  });

  it('records HTTP metrics using the route pattern, not the raw URL', () => {
    const metricsService = new MetricsService();
    const recordSpy = jest.spyOn(metricsService, 'recordHttpRequest');
    const middleware = new RequestLoggingMiddleware(metricsService);
    const req = {
      headers: {},
      method: 'GET',
      originalUrl: '/match/507f1f77bcf86cd799439011',
      route: { path: '/match/:matchId' },
    } as any;
    const res = makeRes();
    res.statusCode = 200;

    middleware.use(req, res, () => {});
    res.emit('finish');

    expect(recordSpy).toHaveBeenCalledWith(
      'GET',
      '/match/:matchId',
      200,
      expect.any(Number),
    );
  });

  it('falls back to "unmatched" when no route was resolved', () => {
    const metricsService = new MetricsService();
    const recordSpy = jest.spyOn(metricsService, 'recordHttpRequest');
    const middleware = new RequestLoggingMiddleware(metricsService);
    const req = {
      headers: {},
      method: 'GET',
      originalUrl: '/does-not-exist',
    } as any;
    const res = makeRes();
    res.statusCode = 404;

    middleware.use(req, res, () => {});
    res.emit('finish');

    expect(recordSpy).toHaveBeenCalledWith(
      'GET',
      'unmatched',
      404,
      expect.any(Number),
    );
  });
});
