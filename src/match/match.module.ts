import { Module } from '@nestjs/common';
import { MatchService } from './match.service';
import { MatchController } from './match.controller';
import { DialogMongoModule } from '../dialog/schemas/dialog.schema';
import { MatchMongoModule } from './schemas/match.schema';
import { LikeMongoModule } from './schemas/like.schema';
import { MessageMongoModule } from '../dialog/schemas/message.schema';

@Module({
  imports: [
    LikeMongoModule,
    MatchMongoModule,
    DialogMongoModule,
    MessageMongoModule,
  ],
  providers: [MatchService],
  controllers: [MatchController],
})
export class MatchModule {}
