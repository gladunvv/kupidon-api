import { TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MatchService } from '../../src/match/match.service';
import { Like, LikeDocument } from '../../src/match/schemas/like.schema';
import { Match, MatchDocument } from '../../src/match/schemas/match.schema';
import { Dialog, DialogDocument } from '../../src/dialog/schemas/dialog.schema';
import {
  Message,
  MessageDocument,
} from '../../src/dialog/schemas/message.schema';
import {
  createMongoTestingModule,
  clearCollections,
  closeMongoTestingModule,
} from './support/mongo';

describe('MatchService concurrent match creation (real MongoDB)', () => {
  let moduleRef: TestingModule;
  let matchService: MatchService;
  let matchModel: Model<MatchDocument>;
  let dialogModel: Model<DialogDocument>;

  beforeAll(async () => {
    moduleRef = await createMongoTestingModule();
    const likeModel = moduleRef.get<Model<LikeDocument>>(
      getModelToken(Like.name),
    );
    matchModel = moduleRef.get(getModelToken(Match.name));
    const messageModel = moduleRef.get<Model<MessageDocument>>(
      getModelToken(Message.name),
    );
    dialogModel = moduleRef.get(getModelToken(Dialog.name));

    matchService = new MatchService(
      likeModel,
      matchModel,
      messageModel,
      dialogModel,
    );
  });

  afterEach(async () => {
    await clearCollections(moduleRef);
  });

  afterAll(async () => {
    await closeMongoTestingModule(moduleRef);
  });

  it('creates exactly one match and one dialog when both users like each other concurrently', async () => {
    const userA = '507f1f77bcf86cd799439011';
    const userB = '507f191e810c19729de860ea';

    const [resultA, resultB] = await Promise.all([
      matchService.likeUser(userA, userB),
      matchService.likeUser(userB, userA),
    ]);

    expect(resultA).not.toBeNull();
    expect(resultB).not.toBeNull();
    expect(resultA!.match._id.toString()).toBe(resultB!.match._id.toString());
    expect(resultA!.dialog._id.toString()).toBe(resultB!.dialog._id.toString());

    await expect(matchModel.countDocuments()).resolves.toBe(1);
    await expect(dialogModel.countDocuments()).resolves.toBe(1);
  });

  it('stays consistent under many concurrent identical likes', async () => {
    const userA = '507f1f77bcf86cd799439011';
    const userB = '507f191e810c19729de860ea';

    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        index % 2 === 0
          ? matchService.likeUser(userA, userB)
          : matchService.likeUser(userB, userA),
      ),
    );

    await expect(matchModel.countDocuments()).resolves.toBe(1);
    await expect(dialogModel.countDocuments()).resolves.toBe(1);
  });
});
