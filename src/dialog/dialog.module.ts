import { Module } from '@nestjs/common';
import { DialogService } from './dialog.service';
import { DialogController } from './dialog.controller';
import { ChatGateway } from '../gateway/chat.gateway';
import { DialogMongoModule } from './schemas/dialog.schema';
import { MessageMongoModule } from './schemas/message.schema';
import { MatchMongoModule } from '../match/schemas/match.schema';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    DialogMongoModule,
    MessageMongoModule,
    MatchMongoModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [DialogService, ChatGateway],
  controllers: [DialogController],
})
export class DialogModule {}
