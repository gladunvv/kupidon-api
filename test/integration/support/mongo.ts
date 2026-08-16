import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import {
  MongooseModule,
  getConnectionToken,
  getModelToken,
} from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { User, UserMongoModule } from '../../../src/users/schemas/user.schema';
import { Like, LikeMongoModule } from '../../../src/match/schemas/like.schema';
import {
  Match,
  MatchMongoModule,
} from '../../../src/match/schemas/match.schema';
import {
  Dialog,
  DialogMongoModule,
} from '../../../src/dialog/schemas/dialog.schema';
import {
  Message,
  MessageMongoModule,
} from '../../../src/dialog/schemas/message.schema';
import { integrationConfig } from './config';

export const INTEGRATION_MONGODB_URI =
  process.env.INTEGRATION_MONGODB_URI ??
  'mongodb://127.0.0.1:27017/kupidon_integration_test';

export async function createMongoTestingModule(): Promise<TestingModule> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [() => integrationConfig],
      }),
      MongooseModule.forRoot(INTEGRATION_MONGODB_URI),
      UserMongoModule,
      LikeMongoModule,
      MatchMongoModule,
      DialogMongoModule,
      MessageMongoModule,
    ],
  }).compile();

  await moduleRef.init();

  await Promise.all(
    [User, Like, Match, Dialog, Message].map((entity) =>
      moduleRef.get(getModelToken(entity.name)).init(),
    ),
  );

  return moduleRef;
}

export async function clearCollections(moduleRef: TestingModule) {
  const connection = moduleRef.get<Connection>(getConnectionToken());
  await Promise.all(
    Object.values(connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );
}

export async function closeMongoTestingModule(moduleRef: TestingModule) {
  const connection = moduleRef.get<Connection>(getConnectionToken());
  await connection.dropDatabase();
  await moduleRef.close();
}
