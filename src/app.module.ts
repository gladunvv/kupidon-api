import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { MatchService } from './match/match.service';
import { MatchModule } from './match/match.module';
import { DialogService } from './dialog/dialog.service';
import { DialogModule } from './dialog/dialog.module';
import { UploadModule } from './upload/upload.module';
import {
  DialogMongoModule,
  LikeMongoModule,
  MatchMongoModule,
  MessageMongoModule,
} from 'src/schemas';
import { RedisModule } from '@liaoliaots/nestjs-redis';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: async () => ({
        uri: process.env.MONGODB_URI || 'mongodb://mongo:27017/datingapp',
      }),
    }),
    RedisModule.forRoot({
      config: {
        url: process.env.REDIS_URL || 'redis://:redispass@redis:6379',
      },
    }),
    AuthModule,
    UsersModule,
    DialogModule,
    MatchModule,
    UploadModule,
    LikeMongoModule,
    MatchMongoModule,
    DialogMongoModule,
    MessageMongoModule,
  ],
  controllers: [AppController],
  providers: [AppService, MatchService, DialogService],
})
export class AppModule {}
