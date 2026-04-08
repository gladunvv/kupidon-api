import { Module } from '@nestjs/common';
import { DialogService } from './dialog.service';
import { DialogController } from './dialog.controller';
import { ChatGateway } from '../gateway/chat.gateway';
import { DialogMongoModule } from './schemas/dialog.schema';
import { MessageMongoModule } from './schemas/message.schema';
import { MatchMongoModule } from '../match/schemas/match.schema';
import { EncryptionModule } from '../encryption/encryption.module';

@Module({
  imports: [
    DialogMongoModule,
    MessageMongoModule,
    MatchMongoModule,
    EncryptionModule,
  ],
  providers: [DialogService, ChatGateway],
  controllers: [DialogController],
})
export class DialogModule {}
