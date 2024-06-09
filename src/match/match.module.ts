import { Module } from '@nestjs/common';
import { MatchService } from './match.service';
import { MatchController } from './match.controller';
import {
  DialogMongoModule,
  MatchMongoModule,
  LikeMongoModule,
} from '../../schemas';

@Module({
  imports: [LikeMongoModule, MatchMongoModule, DialogMongoModule],
  providers: [MatchService],
  controllers: [MatchController],
})
export class MatchModule {}
