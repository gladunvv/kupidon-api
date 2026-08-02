import { NotFoundException } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';

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
