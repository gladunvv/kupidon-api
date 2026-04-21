import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LifestyleCategory,
  LifestyleCategoryDocument,
  LifestyleOption,
  LifestyleOptionDocument,
  Goal,
  GoalDocument,
  Interest,
  InterestDocument,
  City,
  CityDocument,
} from '../reference/schemas';
import { SeedDataService } from './seed-data.service';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(LifestyleCategory.name)
    private readonly lifestyleCategoryModel: Model<LifestyleCategoryDocument>,

    @InjectModel(LifestyleOption.name)
    private readonly lifestyleOptionModel: Model<LifestyleOptionDocument>,

    @InjectModel(Goal.name)
    private readonly goalModel: Model<GoalDocument>,

    @InjectModel(Interest.name)
    private readonly interestModel: Model<InterestDocument>,

    @InjectModel(City.name)
    private readonly cityModel: Model<CityDocument>,

    private readonly seedDataService: SeedDataService,
  ) {}

  async run(): Promise<Record<string, number>> {
    this.logger.log('Seeding reference data');

    await this.replaceCollection(
      this.lifestyleCategoryModel,
      this.seedDataService.getLifestyleCategories(),
    );
    await this.replaceCollection(
      this.lifestyleOptionModel,
      this.seedDataService.getLifestyleOptions(),
    );
    await this.replaceCollection(
      this.goalModel,
      this.seedDataService.getGoals(),
    );
    await this.replaceCollection(
      this.interestModel,
      this.seedDataService.getInterests(),
    );
    await this.replaceCollection(
      this.cityModel,
      this.seedDataService.getCities(),
    );

    const stats = await this.getStats();
    this.logger.log(
      `Seed completed: lifestyleCategories=${stats.lifestyleCategories}, lifestyleOptions=${stats.lifestyleOptions}, goals=${stats.goals}, interests=${stats.interests}, cities=${stats.cities}`,
    );

    return stats;
  }

  private async replaceCollection(
    model: Model<any>,
    data: any[],
  ): Promise<void> {
    await model.deleteMany({});

    if (data.length > 0) {
      await model.insertMany(data);
    }
  }

  async getStats(): Promise<Record<string, number>> {
    const [
      lifestyleCategoriesCount,
      lifestyleOptionsCount,
      goalsCount,
      interestsCount,
      citiesCount,
    ] = await Promise.all([
      this.lifestyleCategoryModel.countDocuments(),
      this.lifestyleOptionModel.countDocuments(),
      this.goalModel.countDocuments(),
      this.interestModel.countDocuments(),
      this.cityModel.countDocuments(),
    ]);

    return {
      lifestyleCategories: lifestyleCategoriesCount,
      lifestyleOptions: lifestyleOptionsCount,
      goals: goalsCount,
      interests: interestsCount,
      cities: citiesCount,
    };
  }
}
