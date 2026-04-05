import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserMongoModule } from './schemas/user.schema';
import { LikeMongoModule } from '../match/schemas/like.schema';

@Module({
  imports: [UserMongoModule, LikeMongoModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
