import { TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../../src/users/users.service';
import { User, UserDocument } from '../../src/users/schemas/user.schema';
import { Like, LikeDocument } from '../../src/match/schemas/like.schema';
import { Match, MatchDocument } from '../../src/match/schemas/match.schema';
import { Dialog, DialogDocument } from '../../src/dialog/schemas/dialog.schema';
import {
  Message,
  MessageDocument,
} from '../../src/dialog/schemas/message.schema';
import { BlockService } from '../../src/block/block.service';
import { Block, BlockDocument } from '../../src/block/schemas/block.schema';
import {
  createMongoTestingModule,
  clearCollections,
  closeMongoTestingModule,
} from './support/mongo';

describe('UsersService.deleteAccount (real MongoDB)', () => {
  let moduleRef: TestingModule;
  let usersService: UsersService;
  let userModel: Model<UserDocument>;
  let likeModel: Model<LikeDocument>;
  let matchModel: Model<MatchDocument>;
  let dialogModel: Model<DialogDocument>;
  let messageModel: Model<MessageDocument>;
  let blockModel: Model<BlockDocument>;
  let storageService: { listKeys: jest.Mock; deleteMany: jest.Mock };

  beforeAll(async () => {
    moduleRef = await createMongoTestingModule();
    userModel = moduleRef.get(getModelToken(User.name));
    likeModel = moduleRef.get(getModelToken(Like.name));
    matchModel = moduleRef.get(getModelToken(Match.name));
    dialogModel = moduleRef.get(getModelToken(Dialog.name));
    messageModel = moduleRef.get(getModelToken(Message.name));
    blockModel = moduleRef.get(getModelToken(Block.name));
    const blockService = new BlockService(blockModel);

    storageService = {
      listKeys: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue(undefined),
    };

    usersService = new UsersService(
      userModel,
      likeModel,
      matchModel,
      dialogModel,
      messageModel,
      blockService,
      storageService as never,
    );
  });

  afterEach(async () => {
    await clearCollections(moduleRef);
    storageService.listKeys.mockClear();
    storageService.deleteMany.mockClear();
  });

  afterAll(async () => {
    await closeMongoTestingModule(moduleRef);
  });

  it('removes the account and every relationship it was part of, leaving a bystander untouched', async () => {
    const me = await userModel.create({ phone: '+79990070001', name: 'Vlad' });
    const partner = await userModel.create({
      phone: '+79990070002',
      name: 'Anna',
    });
    const bystander = await userModel.create({
      phone: '+79990070003',
      name: 'Oleg',
    });

    await likeModel.create({ userId: me._id, likedUserId: partner._id });
    await likeModel.create({ userId: partner._id, likedUserId: me._id });
    const match = await matchModel.create({
      user1: me._id,
      user2: partner._id,
    });
    const dialog = await dialogModel.create({
      matchId: match._id,
      user1: me._id,
      user2: partner._id,
    });
    await messageModel.create({
      sender: me._id,
      dialogId: dialog._id,
      ciphertext: 'c',
      iv: 'i',
      authTag: 't',
      keyVersion: 1,
    });
    await blockModel.create({ blockerId: me._id, blockedId: bystander._id });

    const bystanderMatch = await matchModel.create({
      user1: bystander._id,
      user2: partner._id,
    });

    await usersService.deleteAccount(me._id.toString());

    expect(await userModel.findById(me._id)).toBeNull();
    expect(
      await likeModel.countDocuments({
        $or: [{ userId: me._id }, { likedUserId: me._id }],
      }),
    ).toBe(0);
    expect(await matchModel.findById(match._id)).toBeNull();
    expect(await dialogModel.findById(dialog._id)).toBeNull();
    expect(await messageModel.countDocuments({ dialogId: dialog._id })).toBe(0);
    expect(
      await blockModel.countDocuments({
        $or: [{ blockerId: me._id }, { blockedId: me._id }],
      }),
    ).toBe(0);

    expect(await userModel.findById(partner._id)).not.toBeNull();
    expect(await userModel.findById(bystander._id)).not.toBeNull();
    expect(await matchModel.findById(bystanderMatch._id)).not.toBeNull();
  });

  it('rejects deleting an account that no longer exists', async () => {
    const missingId = '507f1f77bcf86cd799439011';

    await expect(usersService.deleteAccount(missingId)).rejects.toThrow(
      'User not found',
    );
  });
});
