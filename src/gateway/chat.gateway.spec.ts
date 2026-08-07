import { NotFoundException } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';

describe('ChatGateway authentication', () => {
  const setupMiddleware = (
    payload: Record<string, unknown>,
    verificationError?: Error,
  ) => {
    const verify = verificationError
      ? jest.fn(() => {
          throw verificationError;
        })
      : jest.fn().mockReturnValue(payload);
    const jwtService = { verify };
    const gateway = new ChatGateway({} as never, jwtService as never);
    let middleware: (socket: any, next: (error?: Error) => void) => void;
    const server = {
      use: jest.fn((handler) => {
        middleware = handler;
      }),
    };

    gateway.afterInit(server as never);

    return {
      jwtService,
      run: async () => {
        const socket = {
          id: 'socket-1',
          data: {},
          handshake: {
            auth: { token: 'signed-token' },
            headers: {},
          },
        };
        const next = jest.fn();

        await middleware(socket, next);
        return { socket, next };
      },
    };
  };

  it('accepts a valid access token', async () => {
    const { jwtService, run } = setupMiddleware({
      sub: '507f1f77bcf86cd799439011',
      phone: '+79990001122',
      type: 'access',
    });

    const { socket, next } = await run();

    expect(jwtService.verify).toHaveBeenCalledWith('signed-token');
    expect(socket.data).toEqual({
      userId: '507f1f77bcf86cd799439011',
      phone: '+79990001122',
    });
    expect(next).toHaveBeenCalledWith();
  });

  it.each([
    ['refresh token', { sub: '507f1f77bcf86cd799439011', type: 'refresh' }],
    ['token without type', { sub: '507f1f77bcf86cd799439011' }],
    ['token without subject', { type: 'access' }],
  ])('rejects a %s', async (_label, payload) => {
    const { run } = setupMiddleware(payload);

    const { socket, next } = await run();

    expect(socket.data).toEqual({});
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Authentication failed');
  });

  it('rejects an expired access token', async () => {
    const { run } = setupMiddleware({}, new Error('jwt expired'));

    const { socket, next } = await run();

    expect(socket.data).toEqual({});
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Authentication failed');
  });
});

describe('ChatGateway message access', () => {
  it('does not broadcast a message rejected by dialog access control', async () => {
    const dialogService = {
      sendMessage: jest
        .fn()
        .mockRejectedValue(
          new NotFoundException('Dialog not found or access denied'),
        ),
    };
    const gateway = new ChatGateway(dialogService as never, {} as never);
    const broadcast = jest.fn();
    gateway.server = { to: jest.fn(() => ({ emit: broadcast })) } as never;
    const client = {
      data: { userId: '507f191e810c19729de860eb' },
      emit: jest.fn(),
    };

    await gateway.handleSendMessage(
      { dialogId: '507f1f77bcf86cd799439013', text: 'intrusion' },
      client as never,
    );

    expect(dialogService.sendMessage).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439013',
      '507f191e810c19729de860eb',
      'intrusion',
    );
    expect(client.emit).toHaveBeenCalledWith('chat_error', {
      message: 'Failed to send message',
    });
    expect(gateway.server.to).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
  });
});
