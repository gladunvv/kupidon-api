import { LoggerService, LogLevel } from '@nestjs/common';
import { getRequestId } from './request-context';
import { redact } from './redact';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context?: string;
  message?: string;
  requestId?: string;
  meta?: unknown;
  stack?: string;
}

export class StructuredLoggerService implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]) {
    this.write('log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.write('verbose', message, optionalParams);
  }

  private write(level: LogLevel, message: unknown, optionalParams: unknown[]) {
    // Nest calls loggers with a trailing context string and, for errors, an
    // optional stack trace ahead of it — pull those out rather than dumping
    // them into `meta`.
    const params = [...optionalParams];
    const context =
      typeof params[params.length - 1] === 'string'
        ? (params.pop() as string)
        : undefined;
    const stack =
      level === 'error' && typeof params[0] === 'string'
        ? (params.shift() as string)
        : undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      requestId: getRequestId(),
    };

    if (typeof message === 'string') {
      entry.message = message;
    } else {
      // Non-string messages (e.g. the HTTP access log entry) carry their
      // payload as structured fields instead of a stringified blob.
      entry.meta = redact(message);
    }

    if (stack) entry.stack = stack;
    if (params.length > 0) {
      entry.meta = redact(params.length === 1 ? params[0] : params);
    }

    const line = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }
}
