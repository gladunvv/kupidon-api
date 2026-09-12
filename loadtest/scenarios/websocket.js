// Load test for the chat WebSocket gateway. k6 has no Socket.IO client, so
// this hand-rolls the minimal Engine.IO v4 + Socket.IO v4 wire framing
// needed for: connect+auth, join_dialog, send_message, and receiving the
// new_message broadcast back.
//
// Packet shapes (Engine.IO type + optional Socket.IO type + payload):
//   "0{...}"        Engine.IO OPEN (server -> client, handshake info)
//   "40{...}"       Socket.IO CONNECT, payload is the `auth` object
//   "40{"sid":...}" Socket.IO CONNECT ack
//   "42[event,data]" Socket.IO EVENT (both directions)
//   "2" / "3"       Engine.IO PING / PONG keepalive
import ws from 'k6/ws';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend } from 'k6/metrics';

const HOST = __ENV.WS_HOST ?? '127.0.0.1:8000';

const actors = new SharedArray('actors', function () {
  return JSON.parse(open('../actors.json')).filter((a) => a.dialogId);
});

const joinLatency = new Trend('ws_join_dialog_ms');
const messageLatency = new Trend('ws_send_message_roundtrip_ms');

export const options = {
  scenarios: {
    websocket: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },
        { duration: '20s', target: 50 },
        { duration: '5s', target: 0 },
      ],
    },
  },
  thresholds: {
    ws_join_dialog_ms: ['p(95)<300'],
    ws_send_message_roundtrip_ms: ['p(95)<300'],
  },
};

export default function () {
  const actor = actors[__VU % actors.length];
  const url = `ws://${HOST}/socket.io/?EIO=4&transport=websocket`;

  let joinedAt = null;
  let sentMessageAt = null;
  let joined = false;
  let receivedEcho = false;

  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', function () {
      // Wait for the Engine.IO OPEN packet before speaking, per protocol.
    });

    socket.on('message', function (data) {
      if (data === '2') {
        socket.send('3'); // engine.io ping -> pong
        return;
      }

      if (data.startsWith('0')) {
        // Engine.IO OPEN: connect to the default Socket.IO namespace.
        socket.send(`40${JSON.stringify({ token: actor.token })}`);
        return;
      }

      if (data.startsWith('40')) {
        // Socket.IO CONNECT ack: now safe to emit events.
        joinedAt = Date.now();
        socket.send(
          `42${JSON.stringify(['join_dialog', { dialogId: actor.dialogId }])}`,
        );
        return;
      }

      if (data.startsWith('42')) {
        const [event, payload] = JSON.parse(data.slice(2));
        if (event === 'joined_dialog') {
          joined = true;
          joinLatency.add(Date.now() - joinedAt);
          sentMessageAt = Date.now();
          socket.send(
            `42${JSON.stringify([
              'send_message',
              { dialogId: actor.dialogId, text: `ws load test ${__ITER}` },
            ])}`,
          );
        } else if (event === 'new_message') {
          receivedEcho = true;
          messageLatency.add(Date.now() - sentMessageAt);
          socket.close();
        } else if (event === 'chat_error') {
          socket.close();
        }
      }
    });

    socket.setTimeout(function () {
      socket.close();
    }, 5000);
  });

  check(res, { 'ws handshake status is 101': (r) => r && r.status === 101 });
  check(null, {
    'joined dialog': () => joined,
    'received message echo': () => receivedEcho,
  });
}
