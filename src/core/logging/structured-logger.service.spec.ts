import { StructuredLoggerService } from './structured-logger.service';
import { runWithRequestId } from './request-context';

describe('StructuredLoggerService', () => {
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;
  let logger: StructuredLoggerService;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
    logger = new StructuredLoggerService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const lastEntry = (spy: jest.SpyInstance) =>
    JSON.parse(spy.mock.calls[spy.mock.calls.length - 1][0] as string);

  it('writes a single JSON line with timestamp, level and message', () => {
    logger.log('hello world', 'SomeContext');

    const entry = lastEntry(stdoutSpy);
    expect(entry).toMatchObject({
      level: 'log',
      message: 'hello world',
      context: 'SomeContext',
    });
    expect(entry.timestamp).toEqual(expect.any(String));
  });

  it('routes error-level entries to stderr, everything else to stdout', () => {
    logger.error('boom');
    logger.warn('careful');

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
  });

  it('includes the current request id when logging inside a request context', () => {
    runWithRequestId('req-123', () => logger.log('inside a request'));

    expect(lastEntry(stdoutSpy).requestId).toBe('req-123');
  });

  it('omits the request id outside of any request context', () => {
    logger.log('no context here');

    expect(lastEntry(stdoutSpy).requestId).toBeUndefined();
  });

  it('redacts sensitive fields from an object message', () => {
    logger.log({ method: 'POST', path: '/auth/verify-otp', otp: '1234' });

    const entry = lastEntry(stdoutSpy);
    expect(entry.meta).toEqual({
      method: 'POST',
      path: '/auth/verify-otp',
      otp: '[REDACTED]',
    });
  });

  it('extracts the error stack from the second argument on error level', () => {
    logger.error('Unhandled exception', 'fake-stack-trace', 'SomeContext');

    const entry = lastEntry(stderrSpy);
    expect(entry.stack).toBe('fake-stack-trace');
    expect(entry.context).toBe('SomeContext');
  });
});
