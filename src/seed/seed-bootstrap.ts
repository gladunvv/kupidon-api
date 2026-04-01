import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SeedStandaloneModule } from './seed-standalone.module';
import { SeedService } from './seed.service';

const logger = new Logger('SeedBootstrap');

/**
 * Изолированный bootstrap для seed операций
 * Поднимает только необходимые для seed сервисы
 */
export async function createSeedApplication() {
  try {
    logger.log('🚀 Создание изолированного seed приложения...');
    
    const app = await NestFactory.createApplicationContext(SeedStandaloneModule, {
      logger: ['error', 'warn', 'log'],
    });

    logger.log('✅ Seed приложение создано успешно');
    return app;
  } catch (error) {
    logger.error('❌ Ошибка при создании seed приложения:', error);
    throw error;
  }
}

/**
 * Запускает seed операции с изолированным контекстом
 */
export async function runSeedWithIsolation(options: {
  clearExisting?: boolean;
  models?: string[];
  verbose?: boolean;
} = {}) {
  let app;
  
  try {
    app = await createSeedApplication();
    const seedService = app.get(SeedService);

    logger.log('🌱 Запуск seed операций...');
    await seedService.run(options);

    let stats;
    if (options.verbose !== false) {
      stats = await seedService.getStats();
      logger.log('📊 Статистика:');
      Object.entries(stats).forEach(([model, count]) => {
        logger.log(`  ${model}: ${count} записей`);
      });
    } else {
      stats = await seedService.getStats();
    }

    logger.log('✅ Seed операции завершены успешно!');
    return stats;
  } catch (error) {
    logger.error('❌ Ошибка при выполнении seed операций:', error);
    throw error;
  } finally {
    if (app) {
      await app.close();
      logger.log('🔒 Seed приложение закрыто');
    }
  }
}
