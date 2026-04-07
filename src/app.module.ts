import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { MatchModule } from './match/match.module';
import { DialogModule } from './dialog/dialog.module';
import { UploadModule } from './upload/upload.module';
import { SeedModule } from './seed/seed.module';
import { ReferenceModule } from './reference/reference.module';

import { RedisModule } from '@liaoliaots/nestjs-redis';
import { LikeMongoModule } from './match/schemas/like.schema';
import { MatchMongoModule } from './match/schemas/match.schema';
import { DialogMongoModule } from './dialog/schemas/dialog.schema';
import { MessageMongoModule } from './dialog/schemas/message.schema';
import { EncryptionModule } from './encryption/encryption.module';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        MONGODB_URI: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        ENCRYPTION_KEY: Joi.string().required(),
      }),
    }),
    MongooseModule.forRootAsync({
      useFactory: async () => ({
        uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/datingapp',
      }),
    }),
    RedisModule.forRoot({
      config: {
        url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
      },
    }),
    AuthModule,
    UsersModule,
    DialogModule,
    MatchModule,
    UploadModule,
    SeedModule,
    ReferenceModule,
    LikeMongoModule,
    MatchMongoModule,
    DialogMongoModule,
    MessageMongoModule,
    EncryptionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
