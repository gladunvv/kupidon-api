import { Module } from '@nestjs/common';
import { DialogService } from './dialog.service';
import { DialogController } from './dialog.controller';
import { ChatGateway } from '../geteway/chat.geteway';
import { DialogMongoModule, MessageMongoModule } from '../../schemas';

@Module({
  imports: [DialogMongoModule, MessageMongoModule],
  providers: [DialogService, ChatGateway],
  controllers: [DialogController],
})
export class DialogModule {}
