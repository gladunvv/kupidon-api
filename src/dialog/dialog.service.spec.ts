import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { DialogService } from './dialog.service';

describe('DialogService message access', () => {
  const dialogId = '507f1f77bcf86cd799439013';
  const senderId = '507f1f77bcf86cd799439011';

  it('requires the sender to be an active dialog participant', async () => {
    const dialogModel = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const messageModel = jest.fn();
    const service = new DialogService(
      dialogModel as never,
      messageModel as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.sendMessage(dialogId, senderId, 'hello'),
    ).rejects.toThrow(
      new NotFoundException('Dialog not found or access denied'),
    );
    expect(dialogModel.findOne).toHaveBeenCalledWith({
      _id: new Types.ObjectId(dialogId),
      $or: [
        { user1: new Types.ObjectId(senderId) },
        { user2: new Types.ObjectId(senderId) },
      ],
      isActive: true,
    });
    expect(messageModel).not.toHaveBeenCalled();
  });
});
