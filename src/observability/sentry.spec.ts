import * as Sentry from '@sentry/node';
import { captureException, initSentry } from './sentry';

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
}));

describe('sentry wrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initSentry', () => {
    it('does not initialize Sentry when no DSN is configured', () => {
      initSentry(undefined);

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('initializes Sentry with the given DSN', () => {
      initSentry('https://example.invalid/1');

      expect(Sentry.init).toHaveBeenCalledWith({
        dsn: 'https://example.invalid/1',
      });
    });
  });

  describe('captureException', () => {
    it('forwards the error to Sentry', () => {
      const error = new Error('boom');

      captureException(error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });
  });
});
