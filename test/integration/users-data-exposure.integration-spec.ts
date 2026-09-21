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

describe('User data exposure in candidate lists (real MongoDB)', () => {
  let moduleRef: TestingModule;
  let usersService: UsersService;
  let userModel: Model<UserDocument>;

  beforeAll(async () => {
    moduleRef = await createMongoTestingModule();
    userModel = moduleRef.get(getModelToken(User.name));

    usersService = new UsersService(
      userModel,
      moduleRef.get<Model<LikeDocument>>(getModelToken(Like.name)),
      moduleRef.get<Model<MatchDocument>>(getModelToken(Match.name)),
      moduleRef.get<Model<DialogDocument>>(getModelToken(Dialog.name)),
      moduleRef.get<Model<MessageDocument>>(getModelToken(Message.name)),
      new BlockService(
        moduleRef.get<Model<BlockDocument>>(getModelToken(Block.name)),
      ),
      {} as never,
    );
  });

  afterEach(async () => {
    await clearCollections(moduleRef);
  });

  afterAll(async () => {
    await closeMongoTestingModule(moduleRef);
  });

  async function seedPair() {
    const me = await userModel.create({
      phone: '+79990020001',
      gender: 'male',
      age: 30,
      coordinates: [37.6173, 55.7558],
      locationType: 'Point',
      searchPreferences: {
        minAge: 18,
        maxAge: 60,
        maxDistance: 50,
        genders: [],
      },
    });
    const other = await userModel.create({
      phone: '+79990020002',
      gender: 'female',
      age: 28,
      coordinates: [37.62, 55.75],
      locationType: 'Point',
      refreshTokenHash: 'a'.repeat(64),
    });

    return { me, other };
  }

  it('does not expose phone or refreshTokenHash in the matching list', async () => {
    const { me } = await seedPair();

    const { items } = await usersService.findUsersForMatching(
      me._id.toString(),
      1,
      10,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).not.toHaveProperty('phone');
    expect(items[0]).not.toHaveProperty('refreshTokenHash');
  });

  it('does not expose phone or refreshTokenHash in the nearby list', async () => {
    const { me } = await seedPair();

    const { items } = await usersService.findNearbyUsers(
      me._id.toString(),
      undefined,
      50,
      1,
      10,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).not.toHaveProperty('phone');
    expect(items[0]).not.toHaveProperty('refreshTokenHash');
  });

  it('ignores non-profile fields smuggled into the profile update', async () => {
    const { me } = await seedPair();

    await usersService.updateProfile(me._id.toString(), {
      name: 'Vlad',
      phone: '+79990020999',
      isVerified: true,
      refreshTokenHash: 'b'.repeat(64),
    } as never);

    const stored = await userModel
      .findById(me._id)
      .select('+refreshTokenHash')
      .lean();

    expect(stored.name).toBe('Vlad');
    expect(stored.phone).toBe('+79990020001');
    expect(stored.isVerified).toBe(false);
    expect(stored.refreshTokenHash).toBeUndefined();
  });
});
