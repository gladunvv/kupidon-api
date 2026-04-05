import { runSeedWithIsolation } from './seed-bootstrap';

async function bootstrap() {
  try {
    // Получаем параметры из командной строки
    const args = process.argv.slice(2);
    const clearExisting = !args.includes('--no-clear');
    const verbose = !args.includes('--quiet');

    // Определяем модели для заполнения
    let models = ['all'];
    const modelsIndex = args.indexOf('--models');
    if (modelsIndex !== -1 && args[modelsIndex + 1]) {
      models = args[modelsIndex + 1].split(',');
    }

    // Запускаем seed с изолированным контекстом
    await runSeedWithIsolation({
      clearExisting,
      models,
      verbose,
    });
  } catch (error) {
    console.error('❌ Ошибка при заполнении:', error);
    process.exit(1);
  }
}

bootstrap();
