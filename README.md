# Kupidon API

Backend API на `NestJS` для dating-приложения. Проект предоставляет HTTP API для авторизации по OTP, работы с профилем пользователя, мэтчами, диалогами, загрузкой фото, справочниками и служебным сидированием данных.

## Стек

- `NestJS`
- `TypeScript`
- `MongoDB` + `Mongoose`
- `Redis`
- `JWT` + `Passport`
- `Socket.IO`
- `Swagger / OpenAPI`
- `Jest` + `Supertest`

## Основные модули

- `auth` — OTP, access token, refresh token через cookie
- `users` — профиль, поиск, совместимость
- `match` — лайки и мэтчи
- `dialogs` — диалоги и сообщения
- `upload` — загрузка, удаление и сортировка фото
- `reference` — города, интересы, цели и lifestyle-справочники
- `seed` — наполнение справочников
- `core` — общие фильтры, interceptor, pipe, decorators

## Быстрый запуск

### 1. Установка зависимостей

```bash
npm install
```

### 2. Переменные окружения

Проект использует следующие переменные:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/datingapp
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=secret
NODE_ENV=development
```

Если переменные не заданы, часть значений берётся из дефолтов в коде.

### 3. Запуск в dev-режиме

```bash
npm run start:dev
```

API по умолчанию поднимается на:

```text
http://localhost:8000
```

## Swagger и Postman

После запуска приложения доступны:

- Swagger UI: [`http://localhost:8000/docs`](http://localhost:8000/docs)
- OpenAPI JSON: [`http://localhost:8000/docs-json`](http://localhost:8000/docs-json)

Импорт в Postman:

1. Открой `Postman`
2. Нажми `Import`
3. Выбери `Link`
4. Вставь `http://localhost:8000/docs-json`

Postman создаст коллекцию на основе актуальной OpenAPI-схемы.

## Основные команды

```bash
npm run start:dev     # запуск в watch-режиме
npm run build         # сборка проекта
npm run start:prod    # запуск собранной версии

npm run test          # unit/integration tests
npm run test:e2e      # e2e tests
npm run test:cov      # coverage

npm run lint          # eslint
npm run format        # prettier

npm run seed          # запуск сидирования из src
npm run seed:build    # запуск сидирования из dist
```

## Что важно знать

- Все HTTP-ответы проходят через глобальный `ResponseInterceptor`
- Ошибки нормализуются через глобальные exception filters
- Валидация входных данных выполняется глобальным `ValidationPipe`
- Защищённые маршруты работают через `JwtAuthGuard`
- Refresh token хранится в `httpOnly cookie`
- Загруженные файлы раздаются статически через `/uploads`

## Тестирование

В проекте есть e2e-покрытие HTTP endpoint'ов через `Jest` и `Supertest`.

Запуск:

```bash
npm run test:e2e -- --runInBand
```

## Структура проекта

```text
src/
  auth/
  users/
  match/
  dialog/
  upload/
  reference/
  seed/
  core/
```
