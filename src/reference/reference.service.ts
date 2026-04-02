import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  City,
  CityDocument,
  Interest,
  InterestDocument,
  Goal,
  GoalDocument,
  LifestyleCategory,
  LifestyleCategoryDocument,
  LifestyleOption,
  LifestyleOptionDocument,
} from '../schemas';

interface CitySearchOptions {
  countryCode?: string;
  search?: string;
  limit?: number;
}

interface NearbySearchOptions {
  latitude: number;
  longitude: number;
  maxDistance: number;
  limit?: number;
}

@Injectable()
export class ReferenceService {
  constructor(
    @InjectModel(City.name)
    private readonly cityModel: Model<CityDocument>,

    @InjectModel(Interest.name)
    private readonly interestModel: Model<InterestDocument>,

    @InjectModel(Goal.name)
    private readonly goalModel: Model<GoalDocument>,

    @InjectModel(LifestyleCategory.name)
    private readonly lifestyleCategoryModel: Model<LifestyleCategoryDocument>,

    @InjectModel(LifestyleOption.name)
    private readonly lifestyleOptionModel: Model<LifestyleOptionDocument>,
  ) {}

  async getCities(options: CitySearchOptions = {}) {
    const { countryCode, search, limit = 50 } = options;

    let query = this.cityModel.find({ isActive: true });

    if (countryCode) {
      query = query.where({ countryCode });
    }

    if (search) {
      query = query.where({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } },
          { aliases: { $in: [new RegExp(search, 'i')] } },
        ],
      });
    }

    return query
      .sort({ popularity: -1, population: -1 })
      .limit(limit)
      .select('-__v')
      .exec();
  }

  async getPopularCities(limit = 20) {
    return this.cityModel
      .find({ isActive: true })
      .sort({ popularity: -1, population: -1 })
      .limit(limit)
      .select('-__v')
      .exec();
  }

  async getCitiesNearby(options: NearbySearchOptions) {
    const { latitude, longitude, maxDistance, limit = 10 } = options;

    return this.cityModel
      .find({
        isActive: true,
        coordinates: {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            $maxDistance: maxDistance * 1000,
          },
        },
      })
      .limit(limit)
      .select('-__v')
      .exec();
  }

  async getInterests(tags?: string[]) {
    let query = this.interestModel.find();

    if (tags && tags.length > 0) {
      query = query.where({ tags: { $in: tags } });
    }

    return query.sort({ weight: -1, label: 1 }).select('-__v').exec();
  }

  async getGoals() {
    return this.goalModel
      .find()
      .sort({ weight: -1, name: 1 })
      .select('-__v')
      .exec();
  }

  async getLifestyleCategories() {
    return this.lifestyleCategoryModel
      .find()
      .sort({ name: 1 })
      .select('-__v')
      .exec();
  }

  async getLifestyleOptions(categoryId: string) {
    return this.lifestyleOptionModel
      .find({ category: categoryId })
      .populate('category', 'name description')
      .sort({ label: 1 })
      .select('-__v')
      .exec();
  }

  async getAllLifestyleOptions() {
    return this.lifestyleOptionModel
      .find()
      .populate('category', 'name description')
      .sort({ category: 1, label: 1 })
      .select('-__v')
      .exec();
  }

  async getAllReferences() {
    const [cities, interests, goals, lifestyleCategories, lifestyleOptions] =
      await Promise.all([
        this.getPopularCities(30),
        this.getInterests(),
        this.getGoals(),
        this.getLifestyleCategories(),
        this.getAllLifestyleOptions(),
      ]);

    return { cities, interests, goals, lifestyleCategories, lifestyleOptions };
  }

  async getStats() {
    const [
      citiesCount,
      interestsCount,
      goalsCount,
      lifestyleCategoriesCount,
      lifestyleOptionsCount,
    ] = await Promise.all([
      this.cityModel.countDocuments({ isActive: true }),
      this.interestModel.countDocuments(),
      this.goalModel.countDocuments(),
      this.lifestyleCategoryModel.countDocuments(),
      this.lifestyleOptionModel.countDocuments(),
    ]);

    return {
      cities: citiesCount,
      interests: interestsCount,
      goals: goalsCount,
      lifestyleCategories: lifestyleCategoriesCount,
      lifestyleOptions: lifestyleOptionsCount,
    };
  }
}
