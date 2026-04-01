import { runSeedWithIsolation } from './seed-bootstrap';

/**
 * Утилиты для программного использования seed сервиса
 */
export class SeedUtil {
  /**
   * Быстрое заполнение всех моделей
   */
  static async seedAll(clearExisting = true) {
    return runSeedWithIsolation({
      clearExisting,
      models: ['all'],
      verbose: false,
    });
  }

  /**
   * Заполнение только категорий и опций образа жизни
   */
  static async seedLifestyle(clearExisting = true) {
    return runSeedWithIsolation({
      clearExisting,
      models: ['lifestyle-categories', 'lifestyle-options'],
      verbose: false,
    });
  }

  /**
   * Заполнение только целей и интересов
   */
  static async seedGoalsAndInterests(clearExisting = true) {
    return runSeedWithIsolation({
      clearExisting,
      models: ['goals', 'interests'],
      verbose: false,
    });
  }

  /**
   * Заполнение конкретных моделей
   */
  static async seedModels(
    models: string[],
    options: { clearExisting?: boolean; verbose?: boolean } = {},
  ) {
    return runSeedWithIsolation({
      models,
      clearExisting: options.clearExisting ?? true,
      verbose: options.verbose ?? false,
    });
  }

  /**
   * Проверка доступности seed сервиса
   */
  static async healthCheck(): Promise<boolean> {
    try {
      await runSeedWithIsolation({
        clearExisting: false,
        models: [],
        verbose: false,
      });
      return true;
    } catch (error) {
      console.error('Seed health check failed:', error);
      return false;
    }
  }
}

// Экспорт для удобства
export { runSeedWithIsolation } from './seed-bootstrap';
