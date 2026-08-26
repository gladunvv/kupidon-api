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

### Альтернатива: Docker Compose

Не нужны локально установленные MongoDB и Redis — одной командой поднимаются
API, MongoDB и Redis вместе:

```bash
docker compose up --build
```

API стартует только после того, как MongoDB и Redis пройдут собственный
healthcheck (`depends_on: condition: service_healthy`), а не просто после
запуска их контейнеров. Конфигурация берётся из `config.docker.yaml`
(трекается в Git, содержит только тестовые значения — не для реального
деплоя) и монтируется в контейнер как `config.yaml`. Данные MongoDB, Redis и
загруженные фото сохраняются в именованных volume между перезапусками.

```bash
docker compose down        # остановить, данные сохраняются
docker compose down -v     # остановить и удалить volume с данными
```

### Observability: метрики и алерты

`GET /metrics` отдаёт метрики в формате Prometheus без авторизации: request
rate/latency по методу и паттерну маршрута (не сырому URL — иначе каждый id в
пути плодил бы новую time series), статус подключений к MongoDB/Redis,
количество активных WebSocket-соединений, стандартные метрики процесса
(uptime, память, event loop lag).

Поднять Prometheus + Alertmanager поверх основного стека:

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up --build
```

- Prometheus: [`http://localhost:9090`](http://localhost:9090)
- Alertmanager: [`http://localhost:9093`](http://localhost:9093)

Правила алертов в `observability/alerts.yml`: `InstanceDown` (нет ответа на
scrape дольше минуты) и `HighErrorRate` (доля 5xx выше 5% за 5 минут).
Получатель в `observability/alertmanager.yml` — заглушка: алерты
маршрутизируются, но никуда не доставляются, пока туда не добавят реальный
Slack/email/webhook (см. комментарий в файле).

### Error tracking

Опционально — Sentry. Без `sentry.dsn` в `config.yaml` ничего не
активируется. Чтобы включить, добавь:

```yaml
sentry:
  dsn: https://<key>@<org>.ingest.sentry.io/<project>
```

Отправляются только необработанные 5xx-ошибки — не 4xx.

### Backup и восстановление MongoDB

```bash
BACKUP_PASSPHRASE=<секретная-фраза> \
  docker compose -f docker-compose.yml -f docker-compose.backup.yml up --build
```

Сервис `mongo-backup` сразу делает первый дамп, дальше — по расписанию
(`BACKUP_INTERVAL_SECONDS`, по умолчанию `86400` = раз в сутки → **RPO до
24 часов** при дефолтных настройках; для меньшего RPO уменьши интервал).
Каждый бэкап — `mongodump --archive --gzip`, зашифрованный
`openssl aes-256-cbc -pbkdf2` под `BACKUP_PASSPHRASE` (без него контейнер не
стартует). Старые бэкапы старше `RETENTION_DAYS` (по умолчанию `7`) удаляются
при каждом запуске. Файлы лежат в volume `backup-data`, ключ нигде не
сохраняется на диск и не попадает в образ.

Восстановление:

```bash
docker compose exec mongo-backup /scripts/restore.sh /backups/kupidon-<timestamp>.archive.gz.enc
```

`restore.sh` расшифровывает архив и делает `mongorestore --drop` — это
разрушающая операция для целевой базы, применяй на живую БД только осознанно.

Восстановление протестировано вручную: реальные данные → бэкап → шифрование
проверено (расшифровка с неверной парольной фразой падает с `bad decrypt`) →
`dropDatabase` (имитация потери данных) → `restore.sh` → все документы и
уникальные индексы (`users.phone`, `matches`, `likes`, `dialogs`) восстановлены
корректно. Измеренный **RTO ≈ 0.7 секунды** для текущего объёма dev-данных
(включая накладные расходы `docker exec`); для продакшена RTO нужно
переизмерить на реальном объёме данных.

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
- Логи — структурированный JSON (`stdout`/`stderr`). Каждый HTTP-запрос получает `requestId`
  (берётся из входящего заголовка `X-Request-Id`, если он есть, иначе генерируется) — тот же
  ID возвращается в заголовке ответа, в `meta.requestId` тела ответа и во всех логах,
  относящихся к этому запросу; для WebSocket аналогично используется `connectionId` на
  соединение. Чувствительные поля (`phone`, `otp`, `token`, `password`, `secret` и т.д.)
  редактируются логгером автоматически

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
