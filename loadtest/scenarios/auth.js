// Load test for the OTP auth flow: request-otp -> verify-otp. Each
// iteration mints a brand-new phone number so the per-phone cooldown never
// kicks in — that mirrors real traffic (one registration per phone), not a
// single phone hammering the endpoint.
//
// The sandbox SMS provider never exposes the OTP over HTTP (by design —
// see SandboxSmsProvider), so this script reads it straight out of Redis
// the same way OtpService writes it: sha256(phone) as the key suffix.
import http from 'k6/http';
import { check } from 'k6';
import crypto from 'k6/crypto';
import redis from 'k6/x/redis';

const BASE_URL = __ENV.BASE_URL ?? 'http://127.0.0.1:8000';
const REDIS_URL = __ENV.REDIS_URL ?? 'redis://127.0.0.1:16379';

const client = new redis.Client(REDIS_URL);

export const options = {
  scenarios: {
    auth: {
      // Registration isn't a hammer-as-fast-as-possible loop — each phone
      // registers once. 50 VUs x 1 iteration models 50 concurrent new
      // signups hitting the peak at the same moment.
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:request_otp}': ['p(95)<300', 'p(99)<600'],
    'http_req_duration{endpoint:verify_otp}': ['p(95)<300', 'p(99)<600'],
  },
};

export default async function () {
  // Must be a real-looking E.164 Russian mobile number (+7 9XXXXXXXXX,
  // 10 digits total) or class-validator's @IsPhoneNumber() rejects it.
  const uniqueIndex = __VU * 100000 + __ITER;
  const phone = `+79${String(100000000 + uniqueIndex).slice(-9)}`;

  const requestRes = http.post(
    `${BASE_URL}/v1/auth/request-otp`,
    JSON.stringify({ phone }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'request_otp' },
    },
  );
  const requestOk = check(requestRes, {
    'request-otp status is 201': (r) => r.status === 201,
  });
  if (!requestOk) return;

  const hash = crypto.sha256(phone, 'hex');
  const otp = await client.get(`otp:code:${hash}`);
  if (!otp) return;

  const verifyRes = http.post(
    `${BASE_URL}/v1/auth/verify-otp`,
    JSON.stringify({ phone, otp }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'verify_otp' },
    },
  );
  check(verifyRes, {
    'verify-otp status is 201': (r) => r.status === 201,
    'has access_token': (r) => {
      const body = r.json();
      return Boolean(body && body.data && body.data.access_token);
    },
  });
}
