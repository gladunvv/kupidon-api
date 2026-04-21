import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SeedService } from './seed.service';
import { SeedStandaloneModule } from './seed-standalone.module';

const logger = new Logger('SeedCommand');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeedStandaloneModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const stats = await app.get(SeedService).run();
    logger.log(`Reference data seeded: ${JSON.stringify(stats)}`);
  } catch (error) {
    logger.error(
      'Seeding failed',
      error instanceof Error ? error.stack : String(error),
    );
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
