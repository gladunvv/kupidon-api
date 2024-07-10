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
import {
  DialogMongoModule,
  LikeMongoModule,
  MatchMongoModule,
  MessageMongoModule,
} from 'schemas';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: async () => ({
        uri: 'mongodb://localhost/datingapp',
      }),
    }),
    AuthModule,
    UsersModule,
    DialogModule,
    MatchModule,
    LikeMongoModule,
    MatchMongoModule,
    DialogMongoModule,
    MessageMongoModule,
  ],
  controllers: [AppController],
  providers: [AppService, MatchService, DialogService],
})
export class AppModule {}
