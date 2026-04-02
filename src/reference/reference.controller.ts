import { Controller, Get, Query, Param } from '@nestjs/common';
import { ReferenceService } from './reference.service';
import { Public } from '../core/decorators/public.decorator';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { GetCitiesQueryDto } from './dto/get-cities-query.dto';
import { GetInterestsQueryDto } from './dto/get-interests-query.dto';
import { ParseObjectIdPipe } from 'src/core/pipes/parse-object-id.pipe';

@ApiTags('Reference')
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

  @ApiOperation({ summary: 'Get cities with optional filters' })
  @Get('cities')
  async getCities(@Query() query?: GetCitiesQueryDto) {
    const cities = await this.referenceService.getCities({
      countryCode: query.country,
      search: query.search,
      limit: query.limit,
    });
    return this.listPayload(cities);
  }

  @ApiOperation({ summary: 'Get popular cities' })
  @Get('cities/popular')
  async getPopularCities(@Query() query?: GetCitiesQueryDto) {
    const cities = await this.referenceService.getPopularCities(query.limit);
    return this.listPayload(cities);
  }

  @ApiOperation({ summary: 'Find nearby cities by coordinates' })
  @Get('cities/nearby')
  async getCitiesNearby(@Query() query?: GetCitiesQueryDto) {
    const cities = await this.referenceService.getCitiesNearby({
      latitude: query.lat,
      longitude: query.lng,
      maxDistance: query.maxDistance || 100,
      limit: query.limit,
    });
    return this.listPayload(cities);
  }

  @ApiOperation({ summary: 'Get interests with optional tag filter' })
  @Get('interests')
  async getInterests(@Query() query: GetInterestsQueryDto) {
    const interests = await this.referenceService.getInterests(query.tags);
    return this.listPayload(interests);
  }

  @ApiOperation({ summary: 'Get relationship goals' })
  @Get('goals')
  async getGoals() {
    const goals = await this.referenceService.getGoals();
    return this.listPayload(goals);
  }

  @ApiOperation({ summary: 'Get lifestyle categories' })
  @Get('lifestyle-categories')
  async getLifestyleCategories() {
    const categories = await this.referenceService.getLifestyleCategories();
    return this.listPayload(categories);
  }

  @ApiOperation({ summary: 'Get lifestyle options by category' })
  @ApiParam({ name: 'categoryId', example: '66123456789abcdef0123456' })
  @Get('lifestyle-categories/:categoryId/options')
  async getLifestyleOptions(
    @Param('categoryId', ParseObjectIdPipe) categoryId: string,
  ) {
    const options = await this.referenceService.getLifestyleOptions(categoryId);
    return this.listPayload(options);
  }

  @ApiOperation({ summary: 'Get all lifestyle options' })
  @Get('lifestyle-options')
  async getAllLifestyleOptions() {
    const options = await this.referenceService.getAllLifestyleOptions();
    return this.listPayload(options);
  }

  @ApiOperation({ summary: 'Get all reference data at once' })
  @Get('all')
  async getAllReferences() {
    const references = await this.referenceService.getAllReferences();
    return {
      success: true as const,
      data: references,
    };
  }
}
