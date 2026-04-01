import { Module } from '@nestjs/common';
import { DialogService } from './dialog.service';
import { DialogController } from './dialog.controller';
import { ChatGateway } from '../gateway/chat.gateway';
import {
  DialogMongoModule,
  MatchMongoModule,
  MessageMongoModule,
} from '../schemas';
import { JwtModule } from '@nestjs/jwt';
import { jwtSecret } from './../jwtSecret';

@Module({
  imports: [
    DialogMongoModule,
    MessageMongoModule,
    MatchMongoModule,
    JwtModule.register({
      secret: jwtSecret.secret,
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [DialogService, ChatGateway],
  controllers: [DialogController],
})
export class DialogModule {}
