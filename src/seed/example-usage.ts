/**
 * Примеры использования изолированного Seed сервиса
 */

import { SeedUtil } from './seed.util';
import { runSeedWithIsolation } from './seed-bootstrap';

/**
 * Пример 1: Быстрое заполнение всех данных
 */
async function quickSeedExample() {
  console.log('📝 Пример 1: Быстрое заполнение');

  try {
    const stats = await SeedUtil.seedAll();
    console.log('✅ Заполнение завершено:', stats);
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

/**
 * Пример 2: Заполнение конкретных моделей
 */
async function specificModelsExample() {
  console.log('📝 Пример 2: Заполнение конкретных моделей');

  try {
    // Заполняем только цели и интересы без очистки
    const stats = await SeedUtil.seedModels(['goals', 'interests'], {
      clearExisting: false,
      verbose: true,
    });
    console.log('✅ Заполнение завершено:', stats);
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

/**
 * Пример 3: Использование низкоуровневого API
 */
async function lowLevelExample() {
  console.log('📝 Пример 3: Низкоуровневый API');

  try {
    const stats = await runSeedWithIsolation({
      clearExisting: true,
      models: ['lifestyle-categories', 'lifestyle-options'],
      verbose: true,
    });
    console.log('✅ Заполнение завершено:', stats);
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

/**
 * Пример 4: Проверка здоровья сервиса
 */
async function healthCheckExample() {
  console.log('📝 Пример 4: Проверка здоровья');

  const isHealthy = await SeedUtil.healthCheck();
  console.log(
    `🏥 Статус сервиса: ${isHealthy ? '✅ Здоров' : '❌ Недоступен'}`,
  );
}

/**
 * Пример 5: Последовательное заполнение разных типов данных
 */
async function sequentialSeedExample() {
  console.log('📝 Пример 5: Последовательное заполнение');

  try {
    // Сначала заполняем базовые данные
    console.log('1. Заполняем lifestyle данные...');
    await SeedUtil.seedLifestyle();

    // Затем добавляем цели и интересы
    console.log('2. Добавляем цели и интересы...');
    await SeedUtil.seedGoalsAndInterests(false); // без очистки

    console.log('✅ Последовательное заполнение завершено');
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

/**
 * Запуск всех примеров
 */
async function runAllExamples() {
  console.log('🚀 Запуск примеров использования Seed сервиса');
  console.log('='.repeat(50));

  await quickSeedExample();
  console.log();

  await specificModelsExample();
  console.log();

  await lowLevelExample();
  console.log();

  await healthCheckExample();
  console.log();

  await sequentialSeedExample();

  console.log('\n🎉 Все примеры выполнены!');
}

// Запускаем примеры только если файл вызван напрямую
if (require.main === module) {
  runAllExamples().catch(console.error);
}

export {
  quickSeedExample,
  specificModelsExample,
  lowLevelExample,
  healthCheckExample,
  sequentialSeedExample,
};
