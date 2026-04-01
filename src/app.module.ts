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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
