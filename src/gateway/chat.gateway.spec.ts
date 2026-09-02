import { NotFoundException } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ERROR_CODES } from '../core/http/error-codes';

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
      connectionId: expect.any(String),
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

describe('ChatGateway send_message', () => {
  const dialogId = '507f1f77bcf86cd799439013';
  const userId = '507f191e810c19729de860eb';

  const makeClient = () => ({
    data: { userId, connectionId: 'conn-1' },
    emit: jest.fn(),
  });

  it('does not broadcast a message rejected by dialog access control, and surfaces the real reason', async () => {
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
    const client = makeClient();

    await gateway.handleSendMessage(
      { dialogId, text: 'intrusion' },
      client as never,
    );

    expect(dialogService.sendMessage).toHaveBeenCalledWith(
      dialogId,
      userId,
      'intrusion',
    );
    expect(client.emit).toHaveBeenCalledWith('chat_error', {
      code: ERROR_CODES.NOT_FOUND,
      message: 'Dialog not found or access denied',
    });
    expect(gateway.server.to).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('hides an unexpected error behind a generic message, unlike a NotFoundException', async () => {
    const dialogService = {
      sendMessage: jest.fn().mockRejectedValue(new Error('mongo exploded')),
    };
    const gateway = new ChatGateway(dialogService as never, {} as never);
    const client = makeClient();

    await gateway.handleSendMessage(
      { dialogId, text: 'hello' },
      client as never,
    );

    expect(client.emit).toHaveBeenCalledWith('chat_error', {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong',
    });
  });

  describe('payload validation', () => {
    const dialogService = { sendMessage: jest.fn() };

    it.each([
      ['missing dialogId', { text: 'hello' }],
      ['non-ObjectId dialogId', { dialogId: 'not-an-id', text: 'hello' }],
      ['empty text', { dialogId, text: '   ' }],
      ['oversized text', { dialogId, text: 'a'.repeat(1001) }],
      ['unexpected extra field', { dialogId, text: 'hello', admin: true }],
    ])('rejects %s without calling sendMessage', async (_label, payload) => {
      dialogService.sendMessage.mockClear();
      const gateway = new ChatGateway(dialogService as never, {} as never);
      const client = makeClient();

      await gateway.handleSendMessage(payload, client as never);

      expect(dialogService.sendMessage).not.toHaveBeenCalled();
      expect(client.emit).toHaveBeenCalledWith(
        'chat_error',
        expect.objectContaining({ code: ERROR_CODES.VALIDATION_ERROR }),
      );
    });
  });

  describe('rate limiting', () => {
    it('blocks the 11th message within the window without touching the DB', async () => {
      const dialogService = {
        sendMessage: jest.fn().mockResolvedValue({
          _id: 'msg',
          text: 'hi',
          sender: { _id: userId, name: 'Someone' },
          created_at: new Date(),
        }),
      };
      const gateway = new ChatGateway(dialogService as never, {} as never);
      gateway.server = { to: jest.fn(() => ({ emit: jest.fn() })) } as never;
      const client = makeClient();

      for (let i = 0; i < 10; i += 1) {
        await gateway.handleSendMessage(
          { dialogId, text: `message ${i}` },
          client as never,
        );
      }
      expect(dialogService.sendMessage).toHaveBeenCalledTimes(10);

      client.emit.mockClear();
      await gateway.handleSendMessage(
        { dialogId, text: 'one too many' },
        client as never,
      );

      expect(dialogService.sendMessage).toHaveBeenCalledTimes(10);
      expect(client.emit).toHaveBeenCalledWith('chat_error', {
        code: ERROR_CODES.TOO_MANY_MESSAGES,
        message: 'Too many messages, please slow down',
      });
    });

    it("resets a user's limit on disconnect", async () => {
      const dialogService = {
        sendMessage: jest.fn().mockResolvedValue({
          _id: 'msg',
          text: 'hi',
          sender: { _id: userId, name: 'Someone' },
          created_at: new Date(),
        }),
      };
      const gateway = new ChatGateway(dialogService as never, {} as never);
      gateway.server = { to: jest.fn(() => ({ emit: jest.fn() })) } as never;
      const client = makeClient();

      for (let i = 0; i < 10; i += 1) {
        await gateway.handleSendMessage(
          { dialogId, text: `message ${i}` },
          client as never,
        );
      }

      gateway.handleDisconnect(client as never);
      client.emit.mockClear();

      await gateway.handleSendMessage(
        { dialogId, text: 'after reconnect' },
        client as never,
      );

      expect(dialogService.sendMessage).toHaveBeenCalledTimes(11);
      expect(client.emit).not.toHaveBeenCalledWith(
        'chat_error',
        expect.objectContaining({ code: ERROR_CODES.TOO_MANY_MESSAGES }),
      );
    });
  });
});

describe('ChatGateway join_dialog / leave_dialog', () => {
  const dialogId = '507f1f77bcf86cd799439013';
  const userId = '507f191e810c19729de860eb';

  const makeClient = () => ({
    data: { userId, connectionId: 'conn-1' },
    emit: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
  });

  it('joins the dialog room and echoes the partner on success', async () => {
    const dialogService = {
      getDialogWithPartner: jest
        .fn()
        .mockResolvedValue({ partner: { _id: 'partner-1', name: 'Anna' } }),
    };
    const gateway = new ChatGateway(dialogService as never, {} as never);
    const client = makeClient();

    await gateway.handleJoinDialog({ dialogId }, client as never);

    expect(client.join).toHaveBeenCalledWith(dialogId);
    expect(client.emit).toHaveBeenCalledWith('joined_dialog', {
      dialogId,
      success: true,
      partner: { _id: 'partner-1', name: 'Anna' },
    });
  });

  it('reports NOT_FOUND without joining when the dialog is inaccessible', async () => {
    const dialogService = {
      getDialogWithPartner: jest
        .fn()
        .mockRejectedValue(
          new NotFoundException('Dialog not found or access denied'),
        ),
    };
    const gateway = new ChatGateway(dialogService as never, {} as never);
    const client = makeClient();

    await gateway.handleJoinDialog({ dialogId }, client as never);

    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith('chat_error', {
      code: ERROR_CODES.NOT_FOUND,
      message: 'Dialog not found or access denied',
    });
  });

  it('rejects join_dialog with a malformed dialogId', async () => {
    const dialogService = { getDialogWithPartner: jest.fn() };
    const gateway = new ChatGateway(dialogService as never, {} as never);
    const client = makeClient();

    await gateway.handleJoinDialog({ dialogId: 'nope' }, client as never);

    expect(dialogService.getDialogWithPartner).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(
      'chat_error',
      expect.objectContaining({ code: ERROR_CODES.VALIDATION_ERROR }),
    );
  });

  it('leaves the dialog room on success', async () => {
    const gateway = new ChatGateway({} as never, {} as never);
    const client = makeClient();

    await gateway.handleLeaveDialog({ dialogId }, client as never);

    expect(client.leave).toHaveBeenCalledWith(dialogId);
    expect(client.emit).toHaveBeenCalledWith('left_dialog', {
      dialogId,
      success: true,
    });
  });

  it('rejects leave_dialog with a malformed dialogId', async () => {
    const gateway = new ChatGateway({} as never, {} as never);
    const client = makeClient();

    await gateway.handleLeaveDialog({ dialogId: 'nope' }, client as never);

    expect(client.leave).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(
      'chat_error',
      expect.objectContaining({ code: ERROR_CODES.VALIDATION_ERROR }),
    );
  });
});
