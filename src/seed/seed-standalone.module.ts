import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from '../config/load-yaml.config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      skipProcessEnv: true,
      load: [configuration],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('mongodb.uri'),
      }),
    }),
    MongooseModule.forFeature([
      { name: LifestyleCategory.name, schema: LifestyleCategorySchema },
      { name: LifestyleOption.name, schema: LifestyleOptionSchema },
      { name: Goal.name, schema: GoalSchema },
      { name: Interest.name, schema: InterestSchema },
      { name: City.name, schema: CitySchema },
    ]),
  ],
  providers: [SeedService, SeedDataService],
})
export class SeedStandaloneModule {}
