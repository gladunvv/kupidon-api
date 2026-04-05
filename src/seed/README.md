# Seed Service

Изолированный сервис для заполнения базы данных начальными данными. Работает независимо от основного приложения и не требует поднятия всех сервисов.

## Возможности

- ✅ **Изолированная архитектура** - работает независимо от AppModule
- ✅ Гибкая архитектура для добавления новых моделей
- ✅ Поддержка выборочного заполнения моделей
- ✅ Очистка существующих данных (опционально)
- ✅ Подробное логирование процесса
- ✅ API endpoints для управления
- ✅ CLI команды для автоматизации
- ✅ Статистика по количеству записей
- ✅ Программный API для интеграции

## Использование

### CLI команды

```bash
# Заполнить все модели (очистить существующие данные)
npm run seed

# Заполнить без очистки существующих данных
npm run seed -- --no-clear

# Заполнить только определенные модели
npm run seed -- --models lifestyle-categories,goals

# Тихий режим (без подробного логирования)
npm run seed -- --quiet

# Комбинирование параметров
npm run seed -- --models interests --no-clear --quiet
```

### API Endpoints

```bash
# Запустить заполнение через API
POST /seed/run
Content-Type: application/json
{
  "clearExisting": true,
  "models": ["all"],
  "verbose": true
}

# Быстрый запуск через query параметры
POST /seed/quick?clear=true&models=goals,interests&verbose=true

# Получить статистику
GET /seed/stats

# Получить список доступных моделей
GET /seed/models
```

### Программное использование

```typescript
import { SeedUtil } from './src/seed/seed.util';

// Заполнить все модели
await SeedUtil.seedAll();

// Заполнить только lifestyle данные
await SeedUtil.seedLifestyle();

// Заполнить цели и интересы
await SeedUtil.seedGoalsAndInterests();

// Заполнить конкретные модели
await SeedUtil.seedModels(['goals'], { clearExisting: false });

// Проверить доступность сервиса
const isHealthy = await SeedUtil.healthCheck();
```

### Тестирование изоляции

```bash
# Запустить тесты изолированного seed
npm run seed:test
```

## Поддерживаемые модели

- `lifestyle-categories` - Категории образа жизни
- `lifestyle-options` - Опции образа жизни  
- `goals` - Цели знакомств
- `interests` - Интересы пользователей

## Архитектура

### Изолированная архитектура
Seed сервис имеет две конфигурации:

1. **SeedStandaloneModule** - изолированный модуль для CLI команд
   - Содержит только MongoDB подключение и необходимые схемы
   - Не зависит от других сервисов приложения
   - Используется в `seed.command.ts` и `seed-bootstrap.ts`

2. **SeedModule** - интеграционный модуль для основного приложения
   - Предоставляет REST API через SeedController
   - Интегрируется с AppModule
   - Используется для веб-интерфейса управления

### Основные компоненты

#### SeedService
Основной сервис, который координирует процесс заполнения данных.

#### SeedDataService  
Сервис, содержащий все данные для заполнения. Легко расширяется для новых моделей.

#### SeedController
REST API контроллер для управления процессом заполнения.

#### seed-bootstrap.ts
Утилита для создания изолированного контекста приложения.

#### SeedUtil
Программный API для удобного использования seed операций.

## Добавление новых моделей

1. **Добавить модель в SeedDataService:**
```typescript
getNewModel() {
  return [
    { name: 'Пример', value: 'example' },
    // ... другие данные
  ];
}
```

2. **Добавить метод в SeedService:**
```typescript
private async seedNewModel(clearExisting: boolean, verbose: boolean) {
  const modelName = 'NewModel';
  
  if (clearExisting) {
    await this.clearModel(this.newModelModel, modelName, verbose);
  }

  const data = this.seedDataService.getNewModel();
  await this.insertData(this.newModelModel, data, modelName, verbose);
}
```

3. **Обновить метод run() в SeedService:**
```typescript
if (models.includes('all') || models.includes('new-model')) {
  await this.seedNewModel(clearExisting, verbose);
}
```

4. **Добавить в SeedModule импорты и providers**

## Примеры данных

### Категории образа жизни
- Дети, Курение, Алкоголь, Питомцы, Спорт, Питание

### Цели знакомств  
- Серьезные отношения, Дружба, Общение, Флирт, Свидания

### Интересы
- Спорт: Фитнес, Йога, Бег, Плавание
- Творчество: Рисование, Музыка, Фотография
- Развлечения: Кино, Книги, Игры
- Путешествия: Природа, Походы, Пляж

## Безопасность

⚠️ **Внимание**: Seed endpoints помечены как `@Public()` для удобства разработки. В продакшене рекомендуется:

1. Удалить `@Public()` декоратор
2. Добавить аутентификацию и авторизацию
3. Ограничить доступ только для администраторов
4. Или полностью отключить в продакшене

## Логирование

Сервис использует встроенный NestJS Logger с цветными эмодзи для лучшей читаемости:

- 🌱 Начало процесса
- 🗑️ Очистка данных  
- ✨ Добавление данных
- ⚠️ Предупреждения
- ❌ Ошибки
- ✅ Успешное завершение
- 📊 Статистика
