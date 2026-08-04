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

describe('DialogService creation access', () => {
  const matchId = '507f1f77bcf86cd799439012';
  const userId = '507f1f77bcf86cd799439011';

  it('does not reveal or create a dialog for a user outside the match', async () => {
    const dialogModel = { findOneAndUpdate: jest.fn() };
    const matchModel = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new DialogService(
      dialogModel as never,
      {} as never,
      matchModel as never,
      {} as never,
    );

    await expect(service.createDialog(matchId, userId)).rejects.toThrow(
      new NotFoundException('Match not found or access denied'),
    );
    expect(matchModel.findOne).toHaveBeenCalledWith({
      _id: new Types.ObjectId(matchId),
      $or: [
        { user1: new Types.ObjectId(userId) },
        { user2: new Types.ObjectId(userId) },
      ],
    });
    expect(dialogModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('returns the existing dialog for a repeated request', async () => {
    const match = {
      user1: new Types.ObjectId(userId),
      user2: new Types.ObjectId('507f191e810c19729de860ea'),
    };
    const existingDialog = { _id: new Types.ObjectId(), matchId };
    const dialogModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue(existingDialog),
    };
    const matchModel = { findOne: jest.fn().mockResolvedValue(match) };
    const service = new DialogService(
      dialogModel as never,
      {} as never,
      matchModel as never,
      {} as never,
    );

    await expect(service.createDialog(matchId, userId)).resolves.toBe(
      existingDialog,
    );
    expect(dialogModel.findOneAndUpdate).toHaveBeenCalledWith(
      { matchId: new Types.ObjectId(matchId) },
      {
        $setOnInsert: {
          matchId: new Types.ObjectId(matchId),
          user1: match.user1,
          user2: match.user2,
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  });
});
