import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  City,
  CitySchema,
  Interest,
  InterestSchema,
  Goal,
  GoalSchema,
  LifestyleCategory,
  LifestyleCategorySchema,
  LifestyleOption,
  LifestyleOptionSchema,
} from '../schemas';
import { ReferenceController } from './reference.controller';
import { ReferenceService } from './reference.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: City.name,
        schema: CitySchema,
      },
      {
        name: Interest.name,
        schema: InterestSchema,
      },
      {
        name: Goal.name,
        schema: GoalSchema,
      },
      {
        name: LifestyleCategory.name,
        schema: LifestyleCategorySchema,
      },
      {
        name: LifestyleOption.name,
        schema: LifestyleOptionSchema,
      },
    ]),
  ],
  controllers: [ReferenceController],
  providers: [ReferenceService],
  exports: [ReferenceService],
})
export class ReferenceModule {}
