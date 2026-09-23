# Smoke test (REL-03)

One k6 iteration that walks two brand-new users through the full path from
the roadmap: OTP -> profile -> search -> like -> match -> chat -> photo
upload. It's a correctness check against a real, running deployment — not
a load test (see `../loadtest` for that).

## What it proves

- **OTP**: `request-otp` + `verify-otp` create a real account.
- **Profile**: `PUT /v1/users` sets name/age/gender.
- **Search**: each user finds the other via `GET /v1/users/list`.
- **Like / match**: a one-way like doesn't match; the mutual like does and
  returns a dialog.
- **Chat**: a message sent over the WebSocket gateway is broadcast back
  (round trip over one socket — k6's `ws.connect()` blocks its VU until
  the socket closes, so it can't hold two sockets open at once) and the
  *other* user can read it back over `GET /v1/dialogs/:id/messages`,
  proving real cross-user delivery, not just an echo to yourself.
- **Photo upload**: `POST /v1/upload/photos` with a real 400x400 JPEG
  passes MEDIA-02's content/dimension validation.

## Running it

```bash
# 1. Bring up the production-like stack (see ../loadtest/README.md for
#    what to do if 27017/6379/9000 are already taken on your machine)
docker compose up -d --build

# 2. Seed reference data (cities/interests/goals) if not already done
docker compose exec -T api node dist/seed/seed.command.js

# 3. Run it
cd smoke
k6 run smoke.js
```

Env vars, all optional: `BASE_URL` (default `http://127.0.0.1:8000`),
`REDIS_URL` (default `redis://127.0.0.1:6379`), `WS_HOST` (defaults to
`BASE_URL`'s host).

Each run mints two fresh phone numbers from the current timestamp, so
re-running it doesn't collide with a previous run's OTP cooldown.

## Files

- `smoke.js` — the k6 scenario.
- `fixtures/photo.jpg` — a real 400x400 JPEG, generated with `sharp`
  (`Buffer`/text bytes fail the upload's real image validation).
