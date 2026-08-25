import * as Sentry from '@sentry/node';

// Error tracking is opt-in: without a DSN in config.yaml, init() is never
// called and captureException() below is a safe no-op (guaranteed by the
// Sentry SDK), so nothing changes for local dev or CI.
export function initSentry(dsn: string | undefined): void {
  if (!dsn) return;
  Sentry.init({ dsn });
}

export function captureException(error: unknown): void {
  Sentry.captureException(error);
}
