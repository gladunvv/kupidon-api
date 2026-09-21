import { TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MatchService } from '../../src/match/match.service';
import { Like, LikeDocument } from '../../src/match/schemas/like.schema';
import { Match, MatchDocument } from '../../src/match/schemas/match.schema';
import { Dialog, DialogDocument } from '../../src/dialog/schemas/dialog.schema';
import {
  Message,
  MessageDocument,
} from '../../src/dialog/schemas/message.schema';
import { User, UserDocument } from '../../src/users/schemas/user.schema';
import { BlockService } from '../../src/block/block.service';
import { Block, BlockDocument } from '../../src/block/schemas/block.schema';
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
  let blockModel: Model<BlockDocument>;

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
    blockModel = moduleRef.get<Model<BlockDocument>>(getModelToken(Block.name));
    const blockService = new BlockService(blockModel);

    matchService = new MatchService(
      likeModel,
      matchModel,
      messageModel,
      dialogModel,
      blockService,
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

    const result = await matchService.getUserMatches(me._id.toString());
    const matches = result.items as Array<{
      partner: { _id: Types.ObjectId; name: string };
      dialog: { hasLastMessage: boolean };
    }>;

    expect(matches).toHaveLength(1);
    expect(matches[0].partner._id.toString()).toBe(partner._id.toString());
    expect(matches[0].partner.name).toBe('Anna');
    expect(matches[0].dialog.hasLastMessage).toBe(false);
  });

  it('serves match details while the user has an unrelated block', async () => {
    const me = await userModel.create({ phone: '+79990006611', name: 'Vlad' });
    const partner = await userModel.create({
      phone: '+79990006622',
      name: 'Anna',
    });
    const unrelated = await userModel.create({ phone: '+79990006633' });

    const [user1, user2] =
      me._id.toString() < partner._id.toString()
        ? [me._id, partner._id]
        : [partner._id, me._id];
    const match = await matchModel.create({ user1, user2 });
    await blockModel.create({ blockerId: me._id, blockedId: unrelated._id });

    const details = await matchService.getMatchDetails(
      match._id.toString(),
      me._id.toString(),
    );

    expect(details.match._id.toString()).toBe(match._id.toString());
    expect(details.partner).toEqual(expect.objectContaining({ name: 'Anna' }));
  });

  it('hides match details from a user who blocked the partner', async () => {
    const me = await userModel.create({ phone: '+79990006711', name: 'Vlad' });
    const partner = await userModel.create({
      phone: '+79990006722',
      name: 'Anna',
    });

    const [user1, user2] =
      me._id.toString() < partner._id.toString()
        ? [me._id, partner._id]
        : [partner._id, me._id];
    const match = await matchModel.create({ user1, user2 });
    await blockModel.create({ blockerId: me._id, blockedId: partner._id });

    await expect(
      matchService.getMatchDetails(match._id.toString(), me._id.toString()),
    ).rejects.toThrow('Match not found or access denied');
  });

  it('does not include matches that belong to other users', async () => {
    const stranger1 = await userModel.create({ phone: '+79990005511' });
    const stranger2 = await userModel.create({ phone: '+79990005522' });
    await matchModel.create({ user1: stranger1._id, user2: stranger2._id });

    const me = await userModel.create({ phone: '+79990005533' });
    const result = await matchService.getUserMatches(me._id.toString());

    expect(result.items).toHaveLength(0);
  });
});
