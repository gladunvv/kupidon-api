import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  LifestyleCategory,
  LifestyleCategorySchema,
  LifestyleOption,
  LifestyleOptionSchema,
  Goal,
  GoalSchema,
  Interest,
  InterestSchema,
  City,
  CitySchema,
} from '../schemas';
import { SeedService } from './seed.service';
import { SeedDataService } from './seed-data.service';
import { SeedController } from './seed.controller';

/**
 * Модуль для интеграции seed функциональности в основное приложение
 * Предоставляет REST API для управления seed операциями
 * Для CLI команд используется SeedStandaloneModule
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: LifestyleCategory.name,
        schema: LifestyleCategorySchema,
      },
      {
        name: LifestyleOption.name,
        schema: LifestyleOptionSchema,
      },
      {
        name: Goal.name,
        schema: GoalSchema,
      },
      {
        name: Interest.name,
        schema: InterestSchema,
      },
      {
        name: City.name,
        schema: CitySchema,
      },
    ]),
  ],
  controllers: [SeedController],
  providers: [SeedService, SeedDataService],
  exports: [SeedService],
})
export class SeedModule {}
