import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserMongoModule } from './schemas/user.schema';
import { LikeMongoModule } from '../match/schemas/like.schema';
import { MatchMongoModule } from '../match/schemas/match.schema';

@Module({
  imports: [UserMongoModule, LikeMongoModule, MatchMongoModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
