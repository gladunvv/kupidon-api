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
} from 'src/reference/schemas';
import { SeedDataService } from './seed-data.service';

export interface SeedOptions {
  clearExisting?: boolean;
  models?: string[];
  verbose?: boolean;
}

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

  /**
   * Запускает процесс заполнения базы данных
   */
  async run(options: SeedOptions = {}): Promise<void> {
    const { clearExisting = true, models = ['all'], verbose = true } = options;

    this.logger.log('🌱 Начинаем заполнение базы данных...');

    try {
      if (models.includes('all') || models.includes('lifestyle-categories')) {
        await this.seedLifestyleCategories(clearExisting, verbose);
      }

      if (models.includes('all') || models.includes('lifestyle-options')) {
        await this.seedLifestyleOptions(clearExisting, verbose);
      }

      if (models.includes('all') || models.includes('goals')) {
        await this.seedGoals(clearExisting, verbose);
      }

      if (models.includes('all') || models.includes('interests')) {
        await this.seedInterests(clearExisting, verbose);
      }

      if (models.includes('all') || models.includes('cities')) {
        await this.seedCities(clearExisting, verbose);
      }

      this.logger.log('✅ Заполнение базы данных завершено успешно!');
    } catch (error) {
      this.logger.error('❌ Ошибка при заполнении базы данных:', error);
      throw error;
    }
  }

  /**
   * Заполняет категории образа жизни
   */
  private async seedLifestyleCategories(
    clearExisting: boolean,
    verbose: boolean,
  ): Promise<void> {
    const modelName = 'LifestyleCategory';

    if (clearExisting) {
      await this.clearModel(this.lifestyleCategoryModel, modelName, verbose);
    }

    const categories = this.seedDataService.getLifestyleCategories();
    await this.insertData(
      this.lifestyleCategoryModel,
      categories,
      modelName,
      verbose,
    );
  }

  /**
   * Заполняет опции образа жизни
   */
  private async seedLifestyleOptions(
    clearExisting: boolean,
    verbose: boolean,
  ): Promise<void> {
    const modelName = 'LifestyleOption';

    if (clearExisting) {
      await this.clearModel(this.lifestyleOptionModel, modelName, verbose);
    }

    const options = this.seedDataService.getLifestyleOptions();
    await this.insertData(
      this.lifestyleOptionModel,
      options,
      modelName,
      verbose,
    );
  }

  /**
   * Заполняет цели
   */
  private async seedGoals(
    clearExisting: boolean,
    verbose: boolean,
  ): Promise<void> {
    const modelName = 'Goal';

    if (clearExisting) {
      await this.clearModel(this.goalModel, modelName, verbose);
    }

    const goals = this.seedDataService.getGoals();
    await this.insertData(this.goalModel, goals, modelName, verbose);
  }

  /**
   * Заполняет интересы
   */
  private async seedInterests(
    clearExisting: boolean,
    verbose: boolean,
  ): Promise<void> {
    const modelName = 'Interest';

    if (clearExisting) {
      await this.clearModel(this.interestModel, modelName, verbose);
    }

    const interests = this.seedDataService.getInterests();
    await this.insertData(this.interestModel, interests, modelName, verbose);
  }

  /**
   * Заполняет города
   */
  private async seedCities(
    clearExisting: boolean,
    verbose: boolean,
  ): Promise<void> {
    const modelName = 'City';

    if (clearExisting) {
      await this.clearModel(this.cityModel, modelName, verbose);
    }

    const cities = this.seedDataService.getCities();
    await this.insertData(this.cityModel, cities, modelName, verbose);
  }

  /**
   * Очищает модель от существующих данных
   */
  private async clearModel(
    model: Model<any>,
    modelName: string,
    verbose: boolean,
  ): Promise<void> {
    const count = await model.countDocuments();
    if (count > 0) {
      await model.deleteMany({});
      if (verbose) {
        this.logger.log(`🗑️  Удалено ${count} записей из ${modelName}`);
      }
    }
  }

  /**
   * Вставляет данные в модель
   */
  private async insertData(
    model: Model<any>,
    data: any[],
    modelName: string,
    verbose: boolean,
  ): Promise<void> {
    if (data.length === 0) {
      if (verbose) {
        this.logger.warn(`⚠️  Нет данных для вставки в ${modelName}`);
      }
      return;
    }

    try {
      await model.insertMany(data, { ordered: false });
      if (verbose) {
        this.logger.log(`✨ Добавлено ${data.length} записей в ${modelName}`);
      }
    } catch (error) {
      // Игнорируем ошибки дублирования ключей
      if (error.code === 11000) {
        const insertedCount =
          data.length - error.result.writeErrors?.length || 0;
        if (verbose) {
          this.logger.log(
            `✨ Добавлено ${insertedCount} записей в ${modelName} (некоторые уже существовали)`,
          );
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Получает статистику по всем моделям
   */
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
