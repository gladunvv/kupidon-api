// Smoke test for a production-like deployment (REL-03): walks two brand-new
// users through the full path the roadmap calls out — OTP -> profile ->
// search -> like -> match -> chat -> photo upload — against real HTTP,
// Redis and WebSocket endpoints. One VU, one iteration: this proves the
// deployment works end to end, it isn't a load test (see ../loadtest for
// that).
//
// Reuses the OTP-from-Redis trick and the hand-rolled Socket.IO v4 framing
// from ../loadtest/scenarios/auth.js and websocket.js — the sandbox SMS
// provider never exposes the OTP over HTTP, and k6 has no Socket.IO client.
import http from 'k6/http';
import ws from 'k6/ws';
import { check, fail } from 'k6';
import crypto from 'k6/crypto';
import redis from 'k6/x/redis';

const BASE_URL = __ENV.BASE_URL ?? 'http://127.0.0.1:8000';
const REDIS_URL = __ENV.REDIS_URL ?? 'redis://127.0.0.1:6379';
const WS_HOST = __ENV.WS_HOST ?? BASE_URL.replace(/^https?:\/\//, '');

const redisClient = new redis.Client(REDIS_URL);
const photoJpeg = open('./fixtures/photo.jpg', 'b');

export const options = {
  scenarios: {
    smoke: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '60s',
    },
  },
  thresholds: {
    checks: ['rate==1'],
  },
};

function uniquePhone(offset) {
  const index = (Date.now() + offset) % 900000000;
  return `+79${String(100000000 + index).slice(-9)}`;
}

async function registerUser(phone) {
  const requestRes = http.post(
    `${BASE_URL}/v1/auth/request-otp`,
    JSON.stringify({ phone }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (
    !check(requestRes, {
      'request-otp: 201': (r) => r.status === 201,
    })
  ) {
    fail(`request-otp failed for ${phone}: ${requestRes.status} ${requestRes.body}`);
  }

  const hash = crypto.sha256(phone, 'hex');
  const otp = await redisClient.get(`otp:code:${hash}`);
  if (!otp) {
    fail(`no OTP found in Redis for ${phone} — is REDIS_URL pointed at the app's Redis?`);
  }

  const verifyRes = http.post(
    `${BASE_URL}/v1/auth/verify-otp`,
    JSON.stringify({ phone, otp }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (
    !check(verifyRes, {
      'verify-otp: 201': (r) => r.status === 201,
      'verify-otp: has access_token': (r) => Boolean(r.json('data.access_token')),
    })
  ) {
    fail(`verify-otp failed for ${phone}: ${verifyRes.status} ${verifyRes.body}`);
  }

  const body = verifyRes.json();
  return {
    phone,
    token: body.data.access_token,
    userId: body.data.user._id ?? body.data.user.id,
  };
}

function authed(token) {
  return { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } };
}

function completeProfile(user, gender, name) {
  const res = http.put(
    `${BASE_URL}/v1/users`,
    JSON.stringify({ name, age: 25, gender, about: 'REL-03 smoke test account' }),
    authed(user.token),
  );
  check(res, { [`profile updated for ${name}`]: (r) => r.status === 200 });
}

function findCandidate(user, expectedUserId) {
  const res = http.get(`${BASE_URL}/v1/users/list?page=1&limit=50`, authed(user.token));
  const found = check(res, {
    'candidates: 200': (r) => r.status === 200,
    'candidates: search partner is listed': (r) => {
      const items = r.json('data') ?? [];
      return items.some((u) => u._id === expectedUserId || u.id === expectedUserId);
    },
  });
  if (!found) {
    fail(`partner ${expectedUserId} did not show up in candidates for ${user.phone}`);
  }
}

function like(user, likedUserId) {
  const res = http.post(
    `${BASE_URL}/v1/match/like`,
    JSON.stringify({ likedUserId }),
    authed(user.token),
  );
  check(res, { 'like: 201': (r) => r.status === 201 });
  return res.json('data');
}

// k6's ws.connect() blocks the VU until the socket closes, so two sockets
// in one VU can't stay open at once — this uses a single connection (like
// ../loadtest/scenarios/websocket.js) and relies on the gateway broadcasting
// to the whole room, including the sender, for the round-trip check. That
// the *other* user can see the message is proven separately over HTTP, as
// that user, in verifyMessagePersisted below.
function chatOverWebsocket(sender, dialogId, text) {
  const url = `ws://${WS_HOST}/socket.io/?EIO=4&transport=websocket`;
  let joined = false;
  let gotEcho = false;

  const res = ws.connect(url, {}, function (socket) {
    socket.on('message', function (data) {
      if (data === '2') {
        socket.send('3');
        return;
      }
      if (data.startsWith('0')) {
        socket.send(`40${JSON.stringify({ token: sender.token })}`);
        return;
      }
      if (data.startsWith('40')) {
        socket.send(`42${JSON.stringify(['join_dialog', { dialogId }])}`);
        return;
      }
      if (data.startsWith('42')) {
        const [event, payload] = JSON.parse(data.slice(2));
        if (event === 'joined_dialog') {
          joined = true;
          socket.send(`42${JSON.stringify(['send_message', { dialogId, text }])}`);
        } else if (event === 'new_message' && payload.text === text) {
          gotEcho = true;
          socket.close();
        }
      }
    });
    socket.setTimeout(function () {
      socket.close();
    }, 8000);
  });
  check(res, { 'ws handshake: 101': (r) => r && r.status === 101 });
  check(null, {
    'joined dialog over websocket': () => joined,
    'received message broadcast over websocket': () => gotEcho,
  });
}

function verifyMessagePersisted(user, dialogId, text) {
  const res = http.get(`${BASE_URL}/v1/dialogs/${dialogId}/messages?limit=10`, authed(user.token));
  check(res, {
    'messages: 200': (r) => r.status === 200,
    'message persisted': (r) => {
      const items = r.json('data.messages') ?? [];
      return items.some((m) => m.text === text);
    },
  });
}

function uploadPhoto(user) {
  const res = http.post(
    `${BASE_URL}/v1/upload/photos`,
    { photos: http.file(photoJpeg, 'photo.jpg', 'image/jpeg') },
    { headers: { Authorization: `Bearer ${user.token}` } },
  );
  check(res, {
    'upload: 201': (r) => r.status === 201,
    'upload: photo url returned': (r) => (r.json('data.photos') ?? []).length > 0,
  });
}

export default async function () {
  const alice = await registerUser(uniquePhone(0));
  const bob = await registerUser(uniquePhone(1));

  completeProfile(alice, 'female', 'Alice');
  completeProfile(bob, 'male', 'Bob');

  findCandidate(alice, bob.userId);
  findCandidate(bob, alice.userId);

  const firstLike = like(alice, bob.userId);
  check(null, { 'first like is not yet a match': () => firstLike.matched === false });

  const secondLike = like(bob, alice.userId);
  if (!check(null, { 'mutual like creates a match': () => secondLike.matched === true })) {
    fail('mutual like did not produce a match');
  }
  const dialogId = secondLike.dialog._id ?? secondLike.dialog.id;

  const messageText = `smoke test ${Date.now()}`;
  chatOverWebsocket(alice, dialogId, messageText);
  // Bob, not Alice: proves the *other* real user can actually read what
  // Alice sent, not just that Alice can read her own message back.
  verifyMessagePersisted(bob, dialogId, messageText);

  uploadPhoto(alice);
}
