// Load test for the dialog messaging HTTP endpoints: sending a message and
// paging through history. Every VU owns a distinct dialog (paired up by
// seed.js) so sends don't collide on another actor's conversation.
import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.BASE_URL ?? 'http://127.0.0.1:8000';

const actors = new SharedArray('actors', function () {
  return JSON.parse(open('../actors.json')).filter((a) => a.dialogId);
});

export const options = {
  scenarios: {
    messaging: {
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
    'http_req_duration{endpoint:send}': ['p(95)<400', 'p(99)<800'],
    'http_req_duration{endpoint:history}': ['p(95)<400', 'p(99)<800'],
  },
};

export default function () {
  const actor = actors[__VU % actors.length];
  const headers = {
    Authorization: `Bearer ${actor.token}`,
    'Content-Type': 'application/json',
  };

  const sendRes = http.post(
    `${BASE_URL}/v1/dialogs/${actor.dialogId}/messages`,
    JSON.stringify({ text: `load test message ${__ITER}` }),
    { headers, tags: { endpoint: 'send' } },
  );
  check(sendRes, { 'send status is 201': (r) => r.status === 201 });

  const historyRes = http.get(
    `${BASE_URL}/v1/dialogs/${actor.dialogId}/messages?limit=20`,
    { headers, tags: { endpoint: 'history' } },
  );
  check(historyRes, { 'history status is 200': (r) => r.status === 200 });
}
