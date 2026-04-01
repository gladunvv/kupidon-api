import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SeedService, SeedOptions } from './seed.service';
import { Public } from '../core/decorators/public.decorator';

class SeedDto {
  clearExisting?: boolean = true;
  models?: string[] = ['all'];
  verbose?: boolean = true;
}

@Controller('seed')
@Public()
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  /**
   * Запускает процесс заполнения базы данных
   */
  @Post('run')
  @HttpCode(HttpStatus.OK)
  async runSeed(@Body() seedDto: SeedDto) {
    const options: SeedOptions = {
      clearExisting: seedDto.clearExisting ?? true,
      models: seedDto.models ?? ['all'],
      verbose: seedDto.verbose ?? true,
    };

    await this.seedService.run(options);

    return {
      success: true,
      message: 'Заполнение базы данных завершено успешно',
      options,
    };
  }

  /**
   * Запускает seed с параметрами из query string (для простоты использования)
   */
  @Post('quick')
  @HttpCode(HttpStatus.OK)
  async quickSeed(
    @Query('clear') clear?: string,
    @Query('models') models?: string,
    @Query('verbose') verbose?: string,
  ) {
    const options: SeedOptions = {
      clearExisting: clear !== 'false',
      models: models ? models.split(',') : ['all'],
      verbose: verbose !== 'false',
    };

    await this.seedService.run(options);

    return {
      success: true,
      message: 'Заполнение базы данных завершено успешно',
      options,
    };
  }

  /**
   * Получает статистику по количеству записей в каждой модели
   */
  @Get('stats')
  async getStats() {
    const stats = await this.seedService.getStats();

    return {
      success: true,
      data: stats,
      total: Object.values(stats).reduce((sum, count) => sum + count, 0),
    };
  }

  /**
   * Получает информацию о доступных моделях для заполнения
   */
  @Get('models')
  async getAvailableModels() {
    return {
      success: true,
      data: {
        available: [
          'lifestyle-categories',
          'lifestyle-options',
          'goals',
          'interests',
        ],
        description: {
          'lifestyle-categories': 'Категории образа жизни',
          'lifestyle-options': 'Опции образа жизни',
          goals: 'Цели знакомств',
          interests: 'Интересы пользователей',
        },
      },
    };
  }
}
