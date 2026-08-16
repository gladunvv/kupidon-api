import { TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  createMongoTestingModule,
  clearCollections,
  closeMongoTestingModule,
} from './support/mongo';
import { Like, LikeDocument } from '../../src/match/schemas/like.schema';
import { Match, MatchDocument } from '../../src/match/schemas/match.schema';
import { Dialog, DialogDocument } from '../../src/dialog/schemas/dialog.schema';

describe('relationship unique indexes (real MongoDB)', () => {
  let moduleRef: TestingModule;
  let likeModel: Model<LikeDocument>;
  let matchModel: Model<MatchDocument>;
  let dialogModel: Model<DialogDocument>;

  beforeAll(async () => {
    moduleRef = await createMongoTestingModule();
    likeModel = moduleRef.get(getModelToken(Like.name));
    matchModel = moduleRef.get(getModelToken(Match.name));
    dialogModel = moduleRef.get(getModelToken(Dialog.name));
  });

  afterEach(async () => {
    await clearCollections(moduleRef);
  });

  afterAll(async () => {
    await closeMongoTestingModule(moduleRef);
  });

  it('rejects a duplicate like in the same direction', async () => {
    const userId = new Types.ObjectId();
    const likedUserId = new Types.ObjectId();

    await likeModel.create({ userId, likedUserId });

    await expect(
      likeModel.create({ userId, likedUserId }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('allows the reciprocal like in the opposite direction', async () => {
    const userId = new Types.ObjectId();
    const likedUserId = new Types.ObjectId();

    await likeModel.create({ userId, likedUserId });

    await expect(
      likeModel.create({ userId: likedUserId, likedUserId: userId }),
    ).resolves.toBeDefined();
  });

  it('rejects a duplicate match for the same canonical pair', async () => {
    const user1 = new Types.ObjectId();
    const user2 = new Types.ObjectId();

    await matchModel.create({ user1, user2 });

    await expect(matchModel.create({ user1, user2 })).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('rejects a second dialog for the same match', async () => {
    const matchId = new Types.ObjectId();
    const user1 = new Types.ObjectId();
    const user2 = new Types.ObjectId();

    await dialogModel.create({ matchId, user1, user2 });

    await expect(
      dialogModel.create({ matchId, user1, user2 }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});
