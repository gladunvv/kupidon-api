import { Module } from '@nestjs/common';
import { MatchService } from './match.service';
import { MatchController } from './match.controller';
import { DialogMongoModule } from '../dialog/schemas/dialog.schema';
import { MatchMongoModule } from './schemas/match.schema';
import { LikeMongoModule } from './schemas/like.schema';

@Module({
  imports: [LikeMongoModule, MatchMongoModule, DialogMongoModule],
  providers: [MatchService],
  controllers: [MatchController],
})
export class MatchModule {}
