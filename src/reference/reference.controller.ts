import { Controller, Get, Query, Param } from '@nestjs/common';
import { ReferenceService } from './reference.service';
import { Public } from '../core/decorators/public.decorator';

@Controller('reference')
@Public()
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  private listPayload<T extends { length: number }>(data: T) {
    return {
      success: true as const,
      data,
      count: data.length,
    };
  }

  @Get('cities')
  async getCities(
    @Query('country') countryCode?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    const cities = await this.referenceService.getCities({
      countryCode,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return this.listPayload(cities);
  }

  @Get('cities/popular')
  async getPopularCities(@Query('limit') limit?: string) {
    const cities = await this.referenceService.getPopularCities(
      limit ? parseInt(limit, 10) : 20,
    );
    return this.listPayload(cities);
  }

  @Get('cities/nearby')
  async getCitiesNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('maxDistance') maxDistance?: string,
    @Query('limit') limit?: string,
  ) {
    const cities = await this.referenceService.getCitiesNearby({
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      maxDistance: maxDistance ? parseInt(maxDistance, 10) : 100,
      limit: limit ? parseInt(limit, 10) : 10,
    });
    return this.listPayload(cities);
  }

  @Get('interests')
  async getInterests(@Query('tags') tags?: string) {
    const interests = await this.referenceService.getInterests(
      tags ? tags.split(',') : undefined,
    );
    return this.listPayload(interests);
  }

  @Get('goals')
  async getGoals() {
    const goals = await this.referenceService.getGoals();
    return this.listPayload(goals);
  }

  @Get('lifestyle-categories')
  async getLifestyleCategories() {
    const categories = await this.referenceService.getLifestyleCategories();
    return this.listPayload(categories);
  }

  @Get('lifestyle-categories/:categoryId/options')
  async getLifestyleOptions(@Param('categoryId') categoryId: string) {
    const options =
      await this.referenceService.getLifestyleOptions(categoryId);
    return this.listPayload(options);
  }

  @Get('lifestyle-options')
  async getAllLifestyleOptions() {
    const options = await this.referenceService.getAllLifestyleOptions();
    return this.listPayload(options);
  }

  @Get('all')
  async getAllReferences() {
    const references = await this.referenceService.getAllReferences();
    return {
      success: true as const,
      data: references,
    };
  }
}
