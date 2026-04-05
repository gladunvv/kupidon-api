import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SeedService } from './seed.service';
import { SeedDataService } from './seed-data.service';
import {
  LifestyleCategory,
  LifestyleCategorySchema,
} from '../reference/schemas/lifestyle-category.schema';
import {
  LifestyleOption,
  LifestyleOptionSchema,
} from '../reference/schemas/lifestyle-option.schema';
import { Goal, GoalSchema } from '../reference/schemas/goal.schema';
import { Interest, InterestSchema } from '../reference/schemas/interest.schema';
import { City, CitySchema } from '../reference/schemas/city.schema';

/**
 * Изолированный модуль для seed операций
 * Содержит только необходимые зависимости для работы с базой данных
 * Не зависит от AppModule и других сервисов приложения
 */
@Module({
  imports: [
    // Подключение к MongoDB
    MongooseModule.forRootAsync({
      useFactory: async () => ({
        uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/datingapp',
      }),
    }),
    // Регистрация только необходимых схем
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
  providers: [SeedService, SeedDataService],
  exports: [SeedService],
})
export class SeedStandaloneModule {}
