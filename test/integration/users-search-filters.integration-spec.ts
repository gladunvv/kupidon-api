import { TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../../src/users/users.service';
import { User, UserDocument } from '../../src/users/schemas/user.schema';
import { Like, LikeDocument } from '../../src/match/schemas/like.schema';
import { Match, MatchDocument } from '../../src/match/schemas/match.schema';
import {
  createMongoTestingModule,
  clearCollections,
  closeMongoTestingModule,
} from './support/mongo';

describe('UsersService.findUsersForMatching search filters (real MongoDB)', () => {
  let moduleRef: TestingModule;
  let usersService: UsersService;
  let userModel: Model<UserDocument>;
  let likeModel: Model<LikeDocument>;
  let matchModel: Model<MatchDocument>;

  beforeAll(async () => {
    moduleRef = await createMongoTestingModule();
    userModel = moduleRef.get(getModelToken(User.name));
    likeModel = moduleRef.get(getModelToken(Like.name));
    matchModel = moduleRef.get(getModelToken(Match.name));

    usersService = new UsersService(userModel, likeModel, matchModel);
  });

  afterEach(async () => {
    await clearCollections(moduleRef);
  });

  afterAll(async () => {
    await closeMongoTestingModule(moduleRef);
  });

  function extractIds(users: User[]): string[] {
    return users.map((user) => (user as UserDocument)._id.toString());
  }

  it('excludes candidates outside the configured age range', async () => {
    const me = await userModel.create({
      phone: '+79990010001',
      gender: 'male',
      age: 30,
      searchPreferences: {
        minAge: 25,
        maxAge: 35,
        maxDistance: 50,
        genders: [],
      },
    });
    const tooYoung = await userModel.create({
      phone: '+79990010002',
      gender: 'female',
      age: 20,
    });
    const inRange = await userModel.create({
      phone: '+79990010003',
      gender: 'female',
      age: 28,
    });
    const tooOld = await userModel.create({
      phone: '+79990010004',
      gender: 'female',
      age: 40,
    });

    const result = await usersService.findUsersForMatching(me._id.toString());

    const ids = extractIds(result.users);
    expect(ids).toContain(inRange._id.toString());
    expect(ids).not.toContain(tooYoung._id.toString());
    expect(ids).not.toContain(tooOld._id.toString());
  });

  it('filters candidates by the configured gender preferences', async () => {
    const me = await userModel.create({
      phone: '+79990020001',
      gender: 'other',
      age: 30,
      searchPreferences: {
        minAge: 18,
        maxAge: 100,
        maxDistance: 500,
        genders: ['female'],
      },
    });
    const female = await userModel.create({
      phone: '+79990020002',
      gender: 'female',
      age: 25,
    });
    const male = await userModel.create({
      phone: '+79990020003',
      gender: 'male',
      age: 25,
    });

    const result = await usersService.findUsersForMatching(me._id.toString());

    const ids = extractIds(result.users);
    expect(ids).toContain(female._id.toString());
    expect(ids).not.toContain(male._id.toString());
  });

  it('falls back to the opposite gender when no gender preference is set', async () => {
    const me = await userModel.create({
      phone: '+79990030001',
      gender: 'male',
      age: 30,
      searchPreferences: {
        minAge: 18,
        maxAge: 100,
        maxDistance: 500,
        genders: [],
      },
    });
    const female = await userModel.create({
      phone: '+79990030002',
      gender: 'female',
      age: 25,
    });
    const male = await userModel.create({
      phone: '+79990030003',
      gender: 'male',
      age: 25,
    });

    const result = await usersService.findUsersForMatching(me._id.toString());

    const ids = extractIds(result.users);
    expect(ids).toContain(female._id.toString());
    expect(ids).not.toContain(male._id.toString());
  });

  it('excludes candidates further than the configured max distance', async () => {
    const me = await userModel.create({
      phone: '+79990040001',
      gender: 'male',
      age: 30,
      coordinates: [37.6173, 55.7558],
      locationType: 'Point',
      searchPreferences: {
        minAge: 18,
        maxAge: 100,
        maxDistance: 20,
        genders: [],
      },
    });
    const nearby = await userModel.create({
      phone: '+79990040002',
      gender: 'female',
      age: 25,
      coordinates: [37.63, 55.76],
      locationType: 'Point',
    });
    const farAway = await userModel.create({
      phone: '+79990040003',
      gender: 'female',
      age: 25,
      coordinates: [30.3141, 59.9386],
      locationType: 'Point',
    });

    const result = await usersService.findUsersForMatching(me._id.toString());

    const ids = extractIds(result.users);
    expect(ids).toContain(nearby._id.toString());
    expect(ids).not.toContain(farAway._id.toString());
  });

  it('excludes candidates whose account is not active', async () => {
    const me = await userModel.create({
      phone: '+79990050001',
      gender: 'male',
      age: 30,
    });
    const inactive = await userModel.create({
      phone: '+79990050002',
      gender: 'female',
      age: 25,
      isActive: false,
    });
    const active = await userModel.create({
      phone: '+79990050003',
      gender: 'female',
      age: 25,
      isActive: true,
    });

    const result = await usersService.findUsersForMatching(me._id.toString());

    const ids = extractIds(result.users);
    expect(ids).toContain(active._id.toString());
    expect(ids).not.toContain(inactive._id.toString());
  });

  it('excludes already liked and already matched candidates', async () => {
    const me = await userModel.create({
      phone: '+79990060001',
      gender: 'male',
      age: 30,
    });
    const liked = await userModel.create({
      phone: '+79990060002',
      gender: 'female',
      age: 25,
    });
    const matched = await userModel.create({
      phone: '+79990060003',
      gender: 'female',
      age: 25,
    });
    const untouched = await userModel.create({
      phone: '+79990060004',
      gender: 'female',
      age: 25,
    });

    await likeModel.create({ userId: me._id, likedUserId: liked._id });

    const [user1, user2] =
      me._id.toString() < matched._id.toString()
        ? [me._id, matched._id]
        : [matched._id, me._id];
    await matchModel.create({ user1, user2 });

    const result = await usersService.findUsersForMatching(me._id.toString());

    const ids = extractIds(result.users);
    expect(ids).toContain(untouched._id.toString());
    expect(ids).not.toContain(liked._id.toString());
    expect(ids).not.toContain(matched._id.toString());
  });

  it('never returns the requesting user as their own candidate', async () => {
    const me = await userModel.create({
      phone: '+79990070001',
      gender: 'male',
      age: 30,
    });

    const result = await usersService.findUsersForMatching(me._id.toString());

    expect(extractIds(result.users)).not.toContain(me._id.toString());
  });
});
