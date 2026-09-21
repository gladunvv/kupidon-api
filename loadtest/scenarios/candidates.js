// Load test for GET /v1/users/list (candidate feed) — the core browsing
// loop of the app, hit far more often than any write endpoint.
import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.BASE_URL ?? 'http://127.0.0.1:8000';

const actors = new SharedArray('actors', function () {
  return JSON.parse(open('../actors.json'));
});

export const options = {
  scenarios: {
    candidates: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 80 },
        { duration: '30s', target: 80 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<400', 'p(99)<800'],
  },
};

export default function () {
  const actor = actors[__VU % actors.length];
  const page = 1 + (__ITER % 3);

  const res = http.get(
    `${BASE_URL}/v1/users/list?page=${page}&limit=20`,
    { headers: { Authorization: `Bearer ${actor.token}` } },
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has paginated data': (r) => {
      const body = r.json();
      return Array.isArray(body.data) && !!body.meta.pagination;
    },
  });
}
