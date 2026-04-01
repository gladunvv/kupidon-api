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
