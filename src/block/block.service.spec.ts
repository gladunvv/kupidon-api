import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BlockService } from './block.service';

describe('BlockService', () => {
  const userId = '507f1f77bcf86cd799439011';
  const otherUserId = '507f191e810c19729de860ea';

  it('rejects blocking yourself', async () => {
    const blockModel = { findOneAndUpdate: jest.fn() };
    const service = new BlockService(blockModel as never);

    await expect(service.block(userId, userId)).rejects.toThrow(
      new BadRequestException('Cannot block yourself'),
    );
    expect(blockModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('upserts a block record for a new block', async () => {
    const blockModel = {
      findOneAndUpdate: jest
        .fn()
        .mockResolvedValue({ _id: new Types.ObjectId() }),
    };
    const service = new BlockService(blockModel as never);

    await service.block(userId, otherUserId);

    expect(blockModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        blockerId: new Types.ObjectId(userId),
        blockedId: new Types.ObjectId(otherUserId),
      },
      {
        $setOnInsert: {
          blockerId: new Types.ObjectId(userId),
          blockedId: new Types.ObjectId(otherUserId),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  });

  it('removes the block record on unblock', async () => {
    const blockModel = { deleteOne: jest.fn().mockResolvedValue({}) };
    const service = new BlockService(blockModel as never);

    await service.unblock(userId, otherUserId);

    expect(blockModel.deleteOne).toHaveBeenCalledWith({
      blockerId: new Types.ObjectId(userId),
      blockedId: new Types.ObjectId(otherUserId),
    });
  });

  it('reports blocked when either side blocked the other', async () => {
    const blockModel = { exists: jest.fn().mockResolvedValue(true) };
    const service = new BlockService(blockModel as never);
    const a = new Types.ObjectId(userId);
    const b = new Types.ObjectId(otherUserId);

    await expect(service.isBlocked(a, b)).resolves.toBe(true);
    expect(blockModel.exists).toHaveBeenCalledWith({
      $or: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    });
  });

  it('reports not blocked when no relationship exists', async () => {
    const blockModel = { exists: jest.fn().mockResolvedValue(null) };
    const service = new BlockService(blockModel as never);

    await expect(
      service.isBlocked(
        new Types.ObjectId(userId),
        new Types.ObjectId(otherUserId),
      ),
    ).resolves.toBe(false);
  });

  it('removes every block involving the user in either direction', async () => {
    const blockModel = { deleteMany: jest.fn().mockResolvedValue({}) };
    const service = new BlockService(blockModel as never);
    const target = new Types.ObjectId(userId);

    await service.unblockAll(target);

    expect(blockModel.deleteMany).toHaveBeenCalledWith({
      $or: [{ blockerId: target }, { blockedId: target }],
    });
  });

  it('resolves the counterpart id regardless of block direction', async () => {
    const userObjectId = new Types.ObjectId(userId);
    const blockerCounterpart = new Types.ObjectId();
    const blockedCounterpart = new Types.ObjectId();
    const blockModel = {
      find: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { blockerId: userObjectId, blockedId: blockerCounterpart },
          { blockerId: blockedCounterpart, blockedId: userObjectId },
        ]),
      }),
    };
    const service = new BlockService(blockModel as never);

    const result = await service.getBlockedCounterpartIds(userObjectId);

    expect(blockModel.find).toHaveBeenCalledWith({
      $or: [{ blockerId: userObjectId }, { blockedId: userObjectId }],
    });
    expect(result).toEqual([blockerCounterpart, blockedCounterpart]);
  });
});
