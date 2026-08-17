# Kupidon API

Backend API на `NestJS` для dating-приложения. Проект предоставляет HTTP API для авторизации по OTP, работы с профилем пользователя, мэтчами, диалогами, загрузкой фото и справочниками.

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
- `seed` — изолированное сидирование справочников через CLI
- `core` — общие фильтры, interceptor, pipe, decorators

## Быстрый запуск

### 1. Установка зависимостей

```bash
npm install
```

### 2. Конфигурация

Приложение читает настройки из локального `config.yaml`. Скопируй валидный
пример и замени секреты перед production-развёртыванием:

```bash
cp config.example.yaml config.yaml
```

`config.yaml` исключён из Git. Для локального запуска пример ожидает MongoDB на
`127.0.0.1:27017` и Redis на `127.0.0.1:6379`. Приложение завершит запуск с
описанием ошибки, если обязательное поле отсутствует или имеет неверный тип.

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

npm run test          # unit-тесты
npm run test:contract # contract-тесты HTTP-слоя (моки инфраструктуры)
npm run test:integration # integration-тесты на настоящих MongoDB и Redis
npm run test:cov      # coverage

npm run lint          # eslint
npm run format        # prettier

npm run seed          # изолированное заполнение базы справочниками
```

### Безопасное создание relationship-индексов

Перед первым развёртыванием unique indexes сделай резервную копию MongoDB и
останови запись лайков/мэтчей. Затем выполни:

```bash
npm run migrate:relationships:audit  # только аудит, код 2 означает наличие дублей
npm run migrate:relationships:apply  # очистка дублей и создание индексов
npm run migrate:relationships:audit  # контрольный результат должен содержать нули
```

Миграция сохраняет самый старый мэтч/диалог, переносит сообщения из дублирующих
диалогов и пересчитывает `lastMessage`. Повторный запуск безопасен. Для отката
ограничений используй `npm run migrate:relationships:rollback`. Удалённые дубли
эта команда не восстанавливает — для полного отката нужна резервная копия.

## Что важно знать

- Все HTTP-ответы проходят через глобальный `ResponseInterceptor`
- Ошибки нормализуются через глобальные exception filters
- Валидация входных данных выполняется глобальным `ValidationPipe`
- Защищённые маршруты работают через `JwtAuthGuard`
- Refresh token хранится в `httpOnly cookie`
- Загруженные файлы раздаются статически через `/uploads`
- Сидирование не проброшено в публичное API и запускается только отдельной CLI-командой
- Создание мэтча и диалога идемпотентно: каноническая пара пользователей и уникальные индексы позволяют безопасно повторить запрос после частичного сбоя без создания дубликатов

## Тестирование

В проекте три независимых набора тестов, каждый со своим назначением и своей
командой.

### Unit-тесты

`src/**/*.spec.ts`. Проверяют отдельные сервисы в изоляции: инварианты бизнес-
логики, обработку ошибок, граничные случаи. Внешние зависимости замоканы.

```bash
npm run test
```

### Contract-тесты

`test/contract/*.contract-spec.ts`. Поднимают реальный Nest HTTP-слой (guards,
pipes, filters, interceptors) через `Supertest`, но с замоканными сервисами
данных — реальные MongoDB и Redis не нужны. Проверяют контракт эндпоинтов:
статусы, форму ответа, авторизацию, валидацию DTO.

```bash
npm run test:contract -- --runInBand
```

### Integration-тесты

`test/integration/*.integration-spec.ts`. Работают напрямую с настоящими
MongoDB и Redis, без моков инфраструктуры: unique-индексы, агрегации, TTL и
одноразовость OTP, ротация refresh-токена, конкурентное создание мэтча. Нужны
локально запущенные MongoDB на `127.0.0.1:27017` и Redis на `127.0.0.1:6379`
(та же пара, что и для обычного запуска приложения). Тесты используют
отдельную БД `kupidon_integration_test` и Redis DB `15`, чтобы не задевать
dev-данные; переопределить можно через `INTEGRATION_MONGODB_URI` и
`INTEGRATION_REDIS_URL`.

```bash
npm run test:integration
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
