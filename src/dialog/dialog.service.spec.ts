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

describe('DialogService.getMessages (cursor pagination)', () => {
  const dialogId = '507f1f77bcf86cd799439013';
  const userId = '507f1f77bcf86cd799439011';

  const makeChain = (docs: unknown[]) => ({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(docs),
  });

  const makeMessageDoc = (id: string, senderId: string) => ({
    _id: new Types.ObjectId(id),
    ciphertext: `cipher-${id}`,
    iv: 'iv',
    authTag: 'tag',
    keyVersion: 1,
    sender: { _id: new Types.ObjectId(senderId), name: 'Someone' },
    created_at: new Date('2024-01-01T00:00:00.000Z'),
  });

  it('rejects a user who is not an active dialog participant', async () => {
    const dialogModel = { findOne: jest.fn().mockResolvedValue(null) };
    const messageModel = { find: jest.fn() };
    const service = new DialogService(
      dialogModel as never,
      messageModel as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.getMessages(dialogId, userId, { limit: 30 }),
    ).rejects.toThrow(
      new NotFoundException('Dialog not found or access denied'),
    );
    expect(messageModel.find).not.toHaveBeenCalled();
  });

  it("returns a page in ascending order, flags the caller's own messages, and reports hasMore from the extra row", async () => {
    const dialogModel = {
      findOne: jest.fn().mockResolvedValue({ _id: dialogId }),
    };
    const docs = [
      makeMessageDoc('507f1f77bcf86cd799439033', userId),
      makeMessageDoc('507f1f77bcf86cd799439032', '507f1f77bcf86cd799439099'),
      makeMessageDoc('507f1f77bcf86cd799439031', userId),
    ];
    const chain = makeChain(docs);
    const messageModel = { find: jest.fn().mockReturnValue(chain) };
    const encryptionService = {
      decrypt: jest.fn(
        (payload: { ciphertext: string }) => `text:${payload.ciphertext}`,
      ),
    };
    const service = new DialogService(
      dialogModel as never,
      messageModel as never,
      {} as never,
      encryptionService as never,
    );

    const result = await service.getMessages(dialogId, userId, { limit: 2 });

    expect(messageModel.find).toHaveBeenCalledWith({
      dialogId: new Types.ObjectId(dialogId),
    });
    expect(chain.sort).toHaveBeenCalledWith({ _id: -1 });
    expect(chain.limit).toHaveBeenCalledWith(3);
    expect(result.pagination).toEqual({
      hasMore: true,
      nextCursor: '507f1f77bcf86cd799439032',
    });
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]._id).toEqual(docs[1]._id);
    expect(result.messages[1]._id).toEqual(docs[0]._id);
    expect(result.messages[0].isFromCurrentUser).toBe(false);
    expect(result.messages[1].isFromCurrentUser).toBe(true);
  });

  it('passes the before cursor through as an _id upper bound', async () => {
    const dialogModel = { findOne: jest.fn().mockResolvedValue({}) };
    const chain = makeChain([]);
    const messageModel = { find: jest.fn().mockReturnValue(chain) };
    const service = new DialogService(
      dialogModel as never,
      messageModel as never,
      {} as never,
      {} as never,
    );
    const before = '507f1f77bcf86cd799439099';

    await service.getMessages(dialogId, userId, { limit: 10, before });

    expect(messageModel.find).toHaveBeenCalledWith({
      dialogId: new Types.ObjectId(dialogId),
      _id: { $lt: new Types.ObjectId(before) },
    });
  });

  it('reports hasMore false and a null cursor when the page is not full', async () => {
    const dialogModel = { findOne: jest.fn().mockResolvedValue({}) };
    const docs = [makeMessageDoc('507f1f77bcf86cd799439033', userId)];
    const chain = makeChain(docs);
    const messageModel = { find: jest.fn().mockReturnValue(chain) };
    const encryptionService = { decrypt: jest.fn().mockReturnValue('text') };
    const service = new DialogService(
      dialogModel as never,
      messageModel as never,
      {} as never,
      encryptionService as never,
    );

    const result = await service.getMessages(dialogId, userId, { limit: 30 });

    expect(result.pagination).toEqual({ hasMore: false, nextCursor: null });
    expect(result.messages).toHaveLength(1);
  });
});
