import { Module } from '@nestjs/common';
import { StaticService } from './static.service';

@Module({
  controllers: [],
  providers: [StaticService],
  exports: [StaticService],
})
export class StaticModule {}