# Security review (REL-02)

Дата: 15 сентября 2026 года. Ветка: `rel/rel-02-security-review`.

## Область и метод

Ревью охватывает чек-лист REL-02: IDOR, аутентификация и сессии, rate limits,
загрузка файлов, инъекции, CORS/cookies и утечки данных. Проверен весь
прикладной код (`src/`, 7 230 строк без тестов), конфигурация и порядок
инициализации приложения.

Метод: чтение кода целиком, затем проверка каждой гипотезы тестом. Три
находки с наибольшим риском (SR-01, SR-02, SR-03) были сначала воспроизведены
на живой MongoDB, и только после этого исправлены — формулировки ниже
описывают наблюдаемое поведение, а не предположение о нём.

## Закрытые находки

| ID | Область | Критичность | Находка | Проверка |
| --- | --- | --- | --- | --- |
| SR-01 | Утечка данных | High | `GET /v1/users/nearby` отдавал `phone` и `refreshTokenHash` других пользователей, `GET /v1/users/list` — `refreshTokenHash`. Причина: `select: false` и deny-list в `$project` не действуют в агрегациях, а новые поля схемы в deny-list никто не добавлял | `test/integration/users-data-exposure.integration-spec.ts` |
| SR-02 | Mass assignment | High | `PUT /v1/users` писал в документ любые поля тела запроса: `updateProfile` делал spread DTO в `findByIdAndUpdate`, а глобальный `ValidationPipe` не отбрасывал лишние ключи. Позволяло занять чужой номер телефона (это идентификатор входа по OTP), проставить себе `isVerified` или затереть `refreshTokenHash` | `test/integration/users-data-exposure.integration-spec.ts`, `test/contract/users.contract-spec.ts` |
| SR-03 | IDOR | High | Через то же mass assignment можно было записать в свой `photos` URL чужой фотографии, а затем удалить объект из хранилища через `DELETE /v1/upload/photo`: проверка владения смотрела только на собственный массив `photos` | `test/contract/users.contract-spec.ts` (`photos` больше не часть профильного DTO) |
| SR-04 | Инъекции / DoS | Medium | Публичный `GET /v1/reference/cities` подставлял `search` в `$regex` без экранирования (катастрофический бэктрекинг исполняется на стороне MongoDB) и не ограничивал `limit` сверху — полный дамп справочника одним запросом без аутентификации | `src/reference/reference.service.spec.ts`, `test/contract/reference.contract-spec.ts` |
| SR-05 | Auth/session | Medium | `JwtStrategy` не проверял `type` токена, а конфиг допускал короткий секрет и один и тот же секрет для access и refresh. По отдельности каждое безопасно, вместе — refresh-токен становится bearer-токеном ко всему API | `src/auth/jwt.strategy.spec.ts`, `src/config/validate-config.spec.ts` |
| SR-06 | CORS | Medium | CORS WebSocket-шлюза брался из `process.env.FRONTEND_URL` с дефолтом `http://localhost:5173`, хотя приложение читает конфигурацию только из `config.yaml` (`skipProcessEnv: true`) — то есть в любом развёртывании действовал dev-дефолт | Ручная проверка; список берётся из `app.cors.allowedOrigins` |
| SR-07 | Rate limits | Medium | `app.set('trust proxy')` не выставлялся: за обратным прокси `req.ip` — адрес прокси, поэтому per-IP лимит OTP (30/час) становился общим на всех пользователей сразу | Конфигурируемо через `app.trustProxyHops` |
| SR-08 | Заголовки | Medium | Не отдавались security-заголовки, включая `X-Powered-By: Express` | `helmet()` в `src/main.ts` |
| SR-09 | CORS | Medium | В `enableCors` отсутствовал метод `PATCH`, хотя `PATCH /v1/users/search-preferences` существует: браузерный клиент получал отказ на preflight | `src/main.ts` |
| SR-10 | Блокировки | Medium | `GET /v1/match/:matchId` возвращал 404 на **любой** мэтч, если пользователь кого-то заблокировал: `populate(... '-_id')` убирал `_id` партнёра, и `isBlocked(user, undefined)` вырождался в «есть ли у пользователя хоть одна блокировка» | `test/integration/match-aggregation.integration-spec.ts` |
| SR-11 | Валидация | Low | `interests`, `goals`, `lifestyleOptions` принимались массивами любой длины | `ArrayMaxSize(50)` в DTO |

## Проверено и признано корректным

- **IDOR в чате и мэтчах.** Участие пользователя проверяется внутри фильтра
  запроса (`$or: [{user1}, {user2}]`), а не после выборки — и для HTTP, и для
  WebSocket. Посторонний получает 404 без различия «нет объекта» и «нет
  доступа».
- **OTP.** Выдача и проверка — атомарные Lua-скрипты в Redis: cooldown,
  лимиты по номеру и по IP, лимит попыток с блокировкой, одноразовость, TTL.
  Номер и IP хранятся в ключах в виде SHA-256, сам код в логи не попадает.
- **Сессии.** Refresh-токен хэшируется SHA-256 и сравнивается
  `timingSafeEqual`, ротация инвалидирует предыдущий, logout обнуляет хэш.
  Cookie — `httpOnly`, `sameSite=strict`, `secure` в production.
- **Загрузка фото.** Файл не принимается «на слово»: `sharp` разбирает
  содержимое, изображение пережимается в JPEG (EXIF и прочая метадата
  теряются), ограничены размер (5 МБ), количество (5) и разрешение. Ключ
  объекта строится сервером как `users/<userId>/<uuid>.jpg` — имя файла из
  запроса нигде не используется.
- **Инъекции.** Все идентификаторы из path проходят `ParseObjectIdPipe`,
  фильтры собираются из типизированных значений, `$where`/`mapReduce`/`eval`
  не используются. После SR-02 и SR-04 не осталось мест, где значение из
  запроса попадает в запрос к БД непреобразованным.
- **Ошибки.** 5xx всегда отдаются как `Internal server error` с публичным
  кодом; сообщение и stack уходят только в лог и Sentry.
- **Логи.** Ключи `phone`, `otp`, `token`, `secret`, `authorization`,
  `cookie`, `ciphertext` и подобные редактируются рекурсивно.
- **Служебные endpoints.** Swagger не поднимается при `NODE_ENV=production`,
  `/metrics` закрывается токеном (сравнение по хэшу, `timingSafeEqual`),
  `/health/*` не раскрывает ничего, кроме состояния зависимостей.

## Принятые риски

| ID | Риск | Решение и компенсация |
| --- | --- | --- |
| OPEN-01 | Нет глобального HTTP rate limiting: лимиты есть только у OTP (Redis) и у WS `send_message` (in-memory). `POST /v1/dialogs/:id/messages`, `/v1/match/like`, `/v1/users/:id/report` не ограничены на уровне приложения | Осознанно не добавляем зависимость: лимиты настраиваются на nginx/ingress перед API. Пересмотреть, если появится второй инстанс без общего прокси |
| OPEN-02 | Координаты профиля не проверяются на диапазон: `lat=200` приводит к ошибке 2dsphere-индекса и 500 | Вред только себе, данные не портятся. Закрыть вместе с ближайшей задачей по профилю |
| OPEN-03 | `X-Request-Id` принимается от клиента без ограничения длины и алфавита | Значение уходит только в логи и заголовок ответа; Express отбрасывает управляющие символы |
| OPEN-04 | `like`, `block`, `report` не проверяют существование цели | Ответ не различает «есть» и «нет», перебор ObjectId ничего не сообщает |
| OPEN-05 | `UsersService.findAll()` — мёртвый код, возвращающий всех пользователей вместе с `phone` | Нигде не вызывается и не экспонирован. Удалить отдельной задачей, чтобы не смешивать с этим ревью |
| OPEN-06 | `WsRateLimiter` держит счётчики в памяти инстанса | Известное ограничение, задокументировано в коде: при горизонтальном масштабировании лимит умножается на число инстансов |

## Изменения контракта API

Исправления SR-01…SR-03 меняют наблюдаемое поведение — клиенту нужно знать:

- Любое лишнее поле в теле или query-параметрах теперь отклоняется с `400`
  (`whitelist` + `forbidNonWhitelisted` в глобальном `ValidationPipe`).
- `PUT /v1/users` больше не принимает `photos`: фотографии меняются только
  через `/v1/upload/*`.
- `GET /v1/users/list` и `GET /v1/users/nearby` отдают явный список полей
  (`name`, `age`, `gender`, `about`, `photos`, `city`, `interests`, `goals`,
  `lifestyleOptions`, `occupation`, `education`, `height`, `isVerified`,
  `lastActiveAt`, `distance`). Пропали `phone`, `refreshTokenHash`,
  `coordinates`, `searchPreferences`, `isActive`, `locationType`: точные
  координаты чужого пользователя клиенту не нужны — близость выражается полем
  `distance`.
- `GET /v1/match/:matchId` теперь возвращает `_id` партнёра (он нужен для
  блокировки и жалобы и был убран по недосмотру вместе с проверкой блокировки).
- `GET /v1/reference/cities`: `limit` ограничен сотней, `search` — сотней
  символов.

## Требования к развёртыванию

- `jwt.secret` и `jwt.secret_refresh` — не короче 32 символов и обязательно
  разные, иначе приложение не стартует. Генерация: `openssl rand -hex 32`.
- `app.trustProxyHops` — число обратных прокси перед API (например, `1` для
  одного nginx). Без него per-IP лимит OTP не работает за прокси; с числом
  больше фактического клиент сможет подделать `X-Forwarded-For`.
- TLS обязателен: `secure`-cookie и HSTS из `helmet` имеют смысл только на
  HTTPS.
- Rate limiting на прокси — компенсация OPEN-01.

## Как перепроверить

```bash
npm run test            # включая jwt.strategy, validate-config, reference
npm run test:contract -- --runInBand
npm run test:integration
```

Прогон на момент ревью: unit 182/182, contract 93/93, integration 31/31.
Падают 3 теста `storage.integration-spec.ts` — им нужен запущенный MinIO,
к находкам отношения не имеют.
