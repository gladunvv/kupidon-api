import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('exposes the expected metric names in the registry output', async () => {
    const service = new MetricsService();

    const output = await service.registry.metrics();

    expect(output).toContain('http_requests_total');
    expect(output).toContain('http_request_duration_seconds');
    expect(output).toContain('mongodb_connected');
    expect(output).toContain('redis_connected');
    expect(output).toContain('websocket_connections');
  });

  it('records both a counter increment and a duration observation', async () => {
    const service = new MetricsService();

    service.recordHttpRequest('GET', '/match/:matchId', 200, 0.042);

    const output = await service.registry.metrics();
    expect(output).toContain(
      'http_requests_total{method="GET",path="/match/:matchId",status="200"} 1',
    );
    expect(output).toMatch(
      /http_request_duration_seconds_count\{method="GET",path="\/match\/:matchId",status="200"\} 1/,
    );
  });

  it('tracks websocket connection count via inc/dec', async () => {
    const service = new MetricsService();

    service.websocketConnections.inc();
    service.websocketConnections.inc();
    service.websocketConnections.dec();

    const value = (await service.websocketConnections.get()).values[0].value;
    expect(value).toBe(1);
  });
});
