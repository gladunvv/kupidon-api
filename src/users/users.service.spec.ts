import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersService } from './users.service';

function createBlockService() {
  return {
    isBlocked: jest.fn().mockResolvedValue(false),
    getBlockedCounterpartIds: jest.fn().mockResolvedValue([]),
    unblockAll: jest.fn().mockResolvedValue(undefined),
  };
}

function createStorageService(keys: string[] = []) {
  return {
    listKeys: jest.fn().mockResolvedValue(keys),
    deleteMany: jest.fn().mockResolvedValue(undefined),
  };
}

describe('UsersService.deleteAccount', () => {
  const userId = '507f1f77bcf86cd799439011';

  it('throws when the user does not exist', async () => {
    const userModel = { findById: jest.fn().mockResolvedValue(null) };
    const service = new UsersService(
      userModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      createBlockService() as never,
      createStorageService() as never,
    );

    await expect(service.deleteAccount(userId)).rejects.toThrow(
      new NotFoundException('User not found'),
    );
  });

  it('cascades the deletion across dialogs, messages, matches, likes, blocks and photos', async () => {
    const dialogIds = [new Types.ObjectId(), new Types.ObjectId()];
    const userModel = {
      findById: jest.fn().mockResolvedValue({ _id: userId }),
      findByIdAndDelete: jest.fn().mockResolvedValue({ _id: userId }),
    };
    const likeModel = { deleteMany: jest.fn().mockResolvedValue({}) };
    const matchModel = { deleteMany: jest.fn().mockResolvedValue({}) };
    const dialogModel = {
      find: jest.fn().mockReturnValue({
        distinct: jest.fn().mockResolvedValue(dialogIds),
      }),
      deleteMany: jest.fn().mockResolvedValue({}),
    };
    const messageModel = { deleteMany: jest.fn().mockResolvedValue({}) };
    const blockService = createBlockService();
    const storageService = createStorageService([
      'users/507f1f77bcf86cd799439011/a.jpg',
    ]);

    const service = new UsersService(
      userModel as never,
      likeModel as never,
      matchModel as never,
      dialogModel as never,
      messageModel as never,
      blockService as never,
      storageService as never,
    );

    await service.deleteAccount(userId);

    const userObjectId = new Types.ObjectId(userId);

    expect(dialogModel.find).toHaveBeenCalledWith({
      $or: [{ user1: userObjectId }, { user2: userObjectId }],
    });
    expect(messageModel.deleteMany).toHaveBeenCalledWith({
      dialogId: { $in: dialogIds },
    });
    expect(dialogModel.deleteMany).toHaveBeenCalledWith({
      _id: { $in: dialogIds },
    });
    expect(matchModel.deleteMany).toHaveBeenCalledWith({
      $or: [{ user1: userObjectId }, { user2: userObjectId }],
    });
    expect(likeModel.deleteMany).toHaveBeenCalledWith({
      $or: [{ userId: userObjectId }, { likedUserId: userObjectId }],
    });
    expect(blockService.unblockAll).toHaveBeenCalledWith(userObjectId);
    expect(storageService.listKeys).toHaveBeenCalledWith(`users/${userId}/`);
    expect(storageService.deleteMany).toHaveBeenCalledWith([
      'users/507f1f77bcf86cd799439011/a.jpg',
    ]);
    expect(userModel.findByIdAndDelete).toHaveBeenCalledWith(userObjectId);
  });

  it('skips the storage call when the user has no photos', async () => {
    const userModel = {
      findById: jest.fn().mockResolvedValue({ _id: userId }),
      findByIdAndDelete: jest.fn().mockResolvedValue({ _id: userId }),
    };
    const dialogModel = {
      find: jest
        .fn()
        .mockReturnValue({ distinct: jest.fn().mockResolvedValue([]) }),
      deleteMany: jest.fn().mockResolvedValue({}),
    };
    const storageService = createStorageService([]);
    const service = new UsersService(
      userModel as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      dialogModel as never,
      { deleteMany: jest.fn().mockResolvedValue({}) } as never,
      createBlockService() as never,
      storageService as never,
    );

    await service.deleteAccount(userId);

    expect(storageService.listKeys).toHaveBeenCalled();
    expect(storageService.deleteMany).not.toHaveBeenCalled();
  });
});
