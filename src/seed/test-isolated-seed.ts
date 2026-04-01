import { runSeedWithIsolation } from './seed-bootstrap';

/**
 * Тестовый скрипт для проверки изолированного seed
 * Можно запускать независимо от основного приложения
 */
async function testIsolatedSeed() {
  console.log('🧪 Тестирование изолированного seed сервиса...');
  console.log('='.repeat(50));

  try {
    // Тест 1: Полное заполнение
    console.log('\n1️⃣ Тест: Полное заполнение с очисткой');
    const stats1 = await runSeedWithIsolation({
      clearExisting: true,
      models: ['all'],
      verbose: true,
    });
    console.log('✅ Тест 1 пройден:', stats1);

    // Тест 2: Заполнение без очистки
    console.log('\n2️⃣ Тест: Заполнение без очистки');
    const stats2 = await runSeedWithIsolation({
      clearExisting: false,
      models: ['goals'],
      verbose: false,
    });
    console.log('✅ Тест 2 пройден:', stats2);

    // Тест 3: Заполнение конкретных моделей
    console.log('\n3️⃣ Тест: Заполнение конкретных моделей');
    const stats3 = await runSeedWithIsolation({
      clearExisting: false,
      models: ['interests', 'lifestyle-categories'],
      verbose: true,
    });
    console.log('✅ Тест 3 пройден:', stats3);

    console.log('\n🎉 Все тесты пройдены успешно!');
    console.log('Изолированный seed сервис работает корректно.');

  } catch (error) {
    console.error('\n❌ Ошибка при тестировании:', error);
    process.exit(1);
  }
}

// Запускаем тесты только если файл вызван напрямую
if (require.main === module) {
  testIsolatedSeed();
}
