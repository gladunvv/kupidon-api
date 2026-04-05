/**
 * Изолированный Seed сервис для заполнения базы данных
 * 
 * Основные экспорты:
 * - SeedUtil - утилиты для программного использования
 * - runSeedWithIsolation - низкоуровневый API
 * - SeedService, SeedDataService - основные сервисы
 * - SeedModule - для интеграции в основное приложение
 * - SeedStandaloneModule - изолированный модуль для CLI
 */

// Основные утилиты
export { SeedUtil } from './seed.util';
export { runSeedWithIsolation, createSeedApplication } from './seed-bootstrap';

// Сервисы
export { SeedService } from './seed.service';
export { SeedDataService } from './seed-data.service';

// Модули
export { SeedModule } from './seed.module';
export { SeedStandaloneModule } from './seed-standalone.module';

// Контроллер
export { SeedController } from './seed.controller';

// Типы
export type { SeedOptions } from './seed.service';
