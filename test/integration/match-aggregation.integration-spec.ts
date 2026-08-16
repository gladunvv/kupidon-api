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
import { User, UserDocument } from '../../src/users/schemas/user.schema';
import {
  createMongoTestingModule,
  clearCollections,
  closeMongoTestingModule,
} from './support/mongo';

describe('MatchService.getUserMatches aggregation (real MongoDB)', () => {
  let moduleRef: TestingModule;
  let matchService: MatchService;
  let userModel: Model<UserDocument>;
  let matchModel: Model<MatchDocument>;
  let dialogModel: Model<DialogDocument>;

  beforeAll(async () => {
    moduleRef = await createMongoTestingModule();
    userModel = moduleRef.get(getModelToken(User.name));
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

  it('returns the partner profile and dialog presence for a real match', async () => {
    const me = await userModel.create({ phone: '+79990004411', name: 'Vlad' });
    const partner = await userModel.create({
      phone: '+79990004422',
      name: 'Anna',
    });

    const [user1, user2] =
      me._id.toString() < partner._id.toString()
        ? [me._id, partner._id]
        : [partner._id, me._id];
    const match = await matchModel.create({ user1, user2 });
    await dialogModel.create({
      matchId: match._id,
      user1,
      user2,
      isActive: true,
    });

    const matches = await matchService.getUserMatches(me._id.toString());

    expect(matches).toHaveLength(1);
    expect(matches[0].partner._id.toString()).toBe(partner._id.toString());
    expect(matches[0].partner.name).toBe('Anna');
    expect(matches[0].dialog.hasLastMessage).toBe(false);
  });

  it('does not include matches that belong to other users', async () => {
    const stranger1 = await userModel.create({ phone: '+79990005511' });
    const stranger2 = await userModel.create({ phone: '+79990005522' });
    await matchModel.create({ user1: stranger1._id, user2: stranger2._id });

    const me = await userModel.create({ phone: '+79990005533' });
    const matches = await matchService.getUserMatches(me._id.toString());

    expect(matches).toHaveLength(0);
  });
});
