import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AddressInfo } from 'net';
import { io, Socket as ClientSocket } from 'socket.io-client';
import { ChatGateway } from '../../src/gateway/chat.gateway';
import { DialogService } from '../../src/dialog/dialog.service';

const JWT_SECRET = 'chat-gateway-contract-test-secret';
const dialogId = '507f1f77bcf86cd799439013';

class FakeDialogService {
  private counter = 0;

  async getDialogWithPartner(_dialogId: string, _userId: string) {
    return { partner: { _id: 'partner-1', name: 'Partner' } };
  }

  async sendMessage(_dialogId: string, senderId: string, text: string) {
    this.counter += 1;
    return {
      _id: `msg-${this.counter}`,
      text,
      sender: { _id: senderId, name: 'Sender' },
      created_at: new Date().toISOString(),
    };
  }
}

const waitForEvent = <T = unknown>(
  socket: ClientSocket,
  event: string,
): Promise<T> => new Promise((resolve) => socket.once(event, resolve));

const expectNoEvent = (
  socket: ClientSocket,
  event: string,
  ms = 300,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    socket.once(event, () => {
      clearTimeout(timer);
      reject(new Error(`Unexpected "${event}" event received`));
    });
  });

describe('ChatGateway reconnect and delivery (real socket.io transport)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwtService: JwtService;
  const openSockets: ClientSocket[] = [];

  const tokenFor = (userId: string) =>
    jwtService.sign({ sub: userId, phone: '+1', type: 'access' });

  const connectClient = (userId: string): Promise<ClientSocket> =>
    new Promise((resolve, reject) => {
      const socket = io(baseUrl, {
        auth: { token: tokenFor(userId) },
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });
      openSockets.push(socket);
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });

  const joinDialog = async (socket: ClientSocket) => {
    socket.emit('join_dialog', { dialogId });
    return waitForEvent(socket, 'joined_dialog');
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      providers: [
        ChatGateway,
        { provide: DialogService, useClass: FakeDialogService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    jwtService = app.get(JwtService);
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(() => {
    while (openSockets.length) {
      openSockets.pop()?.disconnect();
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('delivers a message live to every joined participant, including the sender', async () => {
    const alice = await connectClient('user-alice');
    const bob = await connectClient('user-bob');
    await joinDialog(alice);
    await joinDialog(bob);

    const [bobMessage, aliceMessage] = await Promise.all([
      waitForEvent<{ text: string }>(bob, 'new_message'),
      waitForEvent<{ text: string }>(alice, 'new_message'),
      Promise.resolve(alice.emit('send_message', { dialogId, text: 'hi bob' })),
    ]);

    expect(bobMessage.text).toBe('hi bob');
    expect(aliceMessage.text).toBe('hi bob');
  });

  it('does not deliver messages sent while a client is disconnected', async () => {
    const alice = await connectClient('user-alice-2');
    const bob = await connectClient('user-bob-2');
    await joinDialog(alice);
    await joinDialog(bob);

    bob.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));

    alice.emit('send_message', { dialogId, text: 'sent while bob is offline' });
    // No assertion possible on bob (socket closed) — this just documents
    // the message was accepted while bob had no live connection.
    await waitForEvent(alice, 'new_message');
  });

  it('requires re-authenticating and re-joining on reconnect, and never replays missed messages over the socket', async () => {
    const alice = await connectClient('user-alice-3');
    const bob = await connectClient('user-bob-3');
    await joinDialog(alice);
    await joinDialog(bob);

    bob.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));

    alice.emit('send_message', {
      dialogId,
      text: 'missed while bob was offline',
    });
    await waitForEvent(alice, 'new_message');

    // Reconnect: a genuinely new transport-level connection, same as a real
    // client reconnecting after a network drop.
    const bobReconnected = await connectClient('user-bob-3');
    const missedMessage = expectNoEvent(bobReconnected, 'new_message', 300);
    await joinDialog(bobReconnected);
    await missedMessage; // catch-up is GET /dialogs/:id/messages's job (CHAT-01), not the socket's

    const [bobLiveMessage] = await Promise.all([
      waitForEvent<{ text: string }>(bobReconnected, 'new_message'),
      Promise.resolve(
        alice.emit('send_message', { dialogId, text: 'after reconnect' }),
      ),
    ]);
    expect(bobLiveMessage.text).toBe('after reconnect');
  });

  it('rejects a connection without a valid access token', async () => {
    await expect(
      new Promise<void>((resolve, reject) => {
        const socket = io(baseUrl, {
          auth: { token: 'not-a-real-token' },
          transports: ['websocket'],
          reconnection: false,
          forceNew: true,
        });
        openSockets.push(socket);
        socket.once('connect', () => resolve());
        socket.once('connect_error', reject);
      }),
    ).rejects.toThrow();
  });
});
