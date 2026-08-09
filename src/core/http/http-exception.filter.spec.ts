import {
  ArgumentsHost,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { MulterError } from 'multer';
import { HttpExceptionFilter } from './http-exception.filter';
import { MulterExceptionFilter } from './multer-exception.filter';

const createHttpHost = () => {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const request = { headers: { 'x-request-id': 'safe-request-id' } };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as ArgumentsHost;

  return { host, response };
};

describe('HttpExceptionFilter error sanitization', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    new Error('MongoDB failed at mongodb://admin:password@internal:27017'),
    new InternalServerErrorException({
      message: 'SQL query and credentials leaked',
      code: 'INTERNAL_DATABASE_ERROR',
      details: { password: 'secret' },
    }),
  ])('returns one generic response for server errors', (exception) => {
    const { host, response } = createHttpHost();

    new HttpExceptionFilter().catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_SERVER_ERROR' },
      meta: {
        timestamp: expect.any(String),
        requestId: 'safe-request-id',
      },
    });
    const body = JSON.stringify(response.json.mock.calls[0][0]);
    expect(body).not.toContain('password');
    expect(body).not.toContain('SQL');
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it('does not expose arbitrary details from a public HTTP error', () => {
    const { host, response } = createHttpHost();
    const exception = new UnauthorizedException({
      message: 'Invalid refresh token',
      code: 'INVALID_TOKEN',
      details: 'jwt secret and parser internals',
    });

    new HttpExceptionFilter().catch(exception, host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid refresh token',
        error: { code: 'INVALID_TOKEN' },
      }),
    );
    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain(
      'parser internals',
    );
  });

  it('maps string HTTP exceptions to a stable public code', () => {
    const { host, response } = createHttpHost();

    new HttpExceptionFilter().catch(
      new NotFoundException('Resource not found'),
      host,
    );

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Resource not found',
        error: { code: 'NOT_FOUND' },
      }),
    );
  });
});

describe('MulterExceptionFilter error sanitization', () => {
  it('does not expose an unknown Multer error message', () => {
    const { host, response } = createHttpHost();
    const exception = new MulterError('LIMIT_PART_COUNT');
    exception.message = 'internal upload path /private/uploads';

    new MulterExceptionFilter().catch(exception, host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'File upload error',
        error: { code: 'BAD_REQUEST' },
      }),
    );
    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain(
      '/private/uploads',
    );
  });
});
