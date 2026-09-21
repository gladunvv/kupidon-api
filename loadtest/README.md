# Load testing (REL-01)

Load tests for the four scenarios called out in the roadmap: auth (OTP),
candidate listing, dialog messaging, and the chat WebSocket. Run against the
`docker-compose.yml` production-like stack with [k6](https://k6.io/).

## Target

Small-pilot scale: **~50–100 concurrent users**, matching the roadmap's
"limited real user group" framing for the first MVP release, not a
long-term capacity plan. Re-run and raise the target before a bigger beta
(REL-05).

| Scenario | Endpoint(s) | Target p95 | Target p99 |
| --- | --- | --- | --- |
| Auth | `POST /v1/auth/request-otp`, `POST /v1/auth/verify-otp` | < 300ms | < 600ms |
| Candidates | `GET /v1/users/list` | < 400ms | < 800ms |
| Messaging | `POST` / `GET /v1/dialogs/:id/messages` | < 400ms | < 800ms |
| WebSocket | `join_dialog`, `send_message` round trip | < 300ms | — |

Error budget: `http_req_failed` rate < 1% for every HTTP scenario.

## Results (2026-09-12, MacBook Pro, single-host docker-compose)

All four scenarios passed every threshold on the first clean run.

| Scenario | VUs | Requests/iterations | p95 | p99 | Error rate |
| --- | --- | --- | --- | --- | --- |
| Auth (one registration per VU) | 50 | 100 HTTP reqs | request-otp 177ms / verify-otp 129ms | request-otp 202ms / verify-otp 130ms | 0% |
| Candidates | 80 (55s ramp) | 20,530 reqs, 373 req/s | 287ms | 430ms | 0% |
| Messaging (send+history) | 80 (55s ramp) | 15,562 reqs, 283 req/s | send 397ms / history 316ms | send 504ms / history 393ms | 0% |
| WebSocket | 50 (35s ramp) | 4,976 sessions | join 14ms / message round-trip 32ms | — | 0% |

Messaging's `send` p95 (397ms) is close to its 400ms target — the first
place to look if the pilot's real traffic runs hotter than this.

These numbers describe a single-host docker-compose stack (API, MongoDB,
Redis, MinIO all sharing one machine's CPU/disk with k6 itself), not
production hardware — treat them as a relative baseline and a pass/fail
gate, not a capacity forecast for a real deployment.

## Prerequisites

- Docker running locally.
- [k6](https://k6.io/docs/get-started/installation/) (`brew install k6`).
  `auth.js` imports `k6/x/redis`, an extension k6 auto-provisions as a
  custom binary the first time you run it (needs network access once).

## Running it

```bash
# 1. Bring up the production-like stack
docker compose up -d --build

# 2. Seed reference data (cities/interests/goals) if not already done
docker compose exec -T api node dist/seed/seed.command.js

# 3. Seed load-test users, matches and dialogs, and mint JWTs for them
#    (bypasses OTP for the non-auth scenarios — see seed.js for why)
npm run loadtest:seed

# 4. Run each scenario
cd loadtest/scenarios
k6 run candidates.js
k6 run messaging.js
k6 run auth.js
k6 run websocket.js
```

### Local port conflicts

If your machine already has something bound to 27017 or 6379 (another
Postgres/Mongo/Redis, a Homebrew service, etc.), Docker's port-forward can
silently coexist with it in a way that routes host traffic to the *wrong*
process instead of failing loudly — `loadtest:seed` will then report
success while the API container's own Mongo stays empty. Remap the
conflicting port in `docker-compose.yml` (e.g. `'27018:27017'`) and pass
`LOADTEST_MONGO_URI=mongodb://127.0.0.1:27018/datingapp` to `seed.js` — but
revert `docker-compose.yml` before committing; it should stay conflict-free
for everyone else.

### OTP rate limiting

`otp.maxRequestsPerIpWindow` in `config.docker.yaml` throttles OTP requests
per client IP — real users each have a different IP, but every k6 VU on one
machine looks like a single IP to the API. If you want to push the auth
scenario past the configured limit (default 30/hour), raise it temporarily
in `config.docker.yaml`, restart the `api` container, and revert it
afterward. `auth.js` already runs as one registration per VU (not a tight
loop), which stays under the default limit at 50 VUs.

## Files

- `seed.js` — populates MongoDB directly with background candidates, actor
  users, matches and dialogs, and writes `actors.json` (gitignored —
  contains JWTs signed with the dev secret from `config.docker.yaml`).
- `scenarios/auth.js` — OTP request+verify; reads the OTP straight out of
  Redis the same way `OtpService` writes it, since the sandbox SMS provider
  never exposes it over HTTP.
- `scenarios/candidates.js`, `scenarios/messaging.js` — plain HTTP load
  against the paginated candidate feed and the dialog messaging endpoints.
- `scenarios/websocket.js` — hand-rolled minimal Engine.IO v4 / Socket.IO
  v4 framing over `k6/ws` (k6 has no Socket.IO client), covering connect
  auth, `join_dialog`, and a `send_message` round trip.
