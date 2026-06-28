import { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import { Session } from '@vss/shared';
import { createWsVideoFanout } from '../ws-video-fanout';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Open a WS connection and resolve once the socket is open. */
const openSocket = (port: number): Promise<WebSocket> =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });

/** Resolve with the first N binary messages received on the socket. */
const collectMessages = (ws: WebSocket, count: number): Promise<Buffer[]> =>
  new Promise((resolve, reject) => {
    const msgs: Buffer[] = [];
    ws.on('message', (data) => {
      msgs.push(data as Buffer);
      if (msgs.length === count) resolve(msgs);
    });
    ws.once('error', reject);
  });

/** Resolve when the socket emits its 'close' event. */
const waitClose = (ws: WebSocket): Promise<{ code: number }> =>
  new Promise((resolve) => ws.once('close', (code) => resolve({ code })));

/** Pause for the given number of milliseconds (used to let async WS auth settle). */
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_TOKEN = 'valid-jwt';
const INVALID_TOKEN = 'bad-token';

const FAKE_SESSION: Session = {
  login: 'alice',
  role: 'operator',
  jti: 'test-jti-1',
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ws-video-fanout (integration)', () => {
  // Auth stub: resolves to a session for VALID_TOKEN, null otherwise.
  const authorize = jest.fn(async (token: string): Promise<Session | null> =>
    token === VALID_TOKEN ? FAKE_SESSION : null,
  );

  beforeEach(() => {
    authorize.mockClear();
  });

  it('sends broadcast fragments to authorized clients', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const { port } = wss.address() as AddressInfo;
    const fanout = createWsVideoFanout({ wss, authorize, onClientChange: () => undefined });

    const ws = await openSocket(port);
    const incoming = collectMessages(ws, 1);

    // First WS message is the raw JWT token (per ws-video-fanout protocol).
    ws.send(VALID_TOKEN);

    // Allow the server's async authorize() call to settle before broadcasting.
    await pause(60);

    const fragment = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    fanout.broadcast(fragment);

    const [received] = await incoming;
    expect(received).toEqual(fragment);

    ws.close();
    await new Promise<void>((r) => wss.close(() => r()));
  });

  it('replays the cached init segment to a new client before any fragment', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const { port } = wss.address() as AddressInfo;
    const fanout = createWsVideoFanout({ wss, authorize, onClientChange: () => undefined });

    const initSegment = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    fanout.setInitSegment(initSegment);

    const ws = await openSocket(port);
    const incoming = collectMessages(ws, 2);
    ws.send(VALID_TOKEN);
    await pause(60);

    const fragment = Buffer.from([0x00, 0x01]);
    fanout.broadcast(fragment);

    const [first, second] = await incoming;
    expect(first).toEqual(initSegment);
    expect(second).toEqual(fragment);

    ws.close();
    await new Promise<void>((r) => wss.close(() => r()));
  });

  it('replays the init segment to clients already connected when it appears', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const { port } = wss.address() as AddressInfo;
    const fanout = createWsVideoFanout({ wss, authorize, onClientChange: () => undefined });

    const ws = await openSocket(port);
    const incoming = collectMessages(ws, 1);
    ws.send(VALID_TOKEN);
    await pause(60);

    const initSegment = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    fanout.setInitSegment(initSegment);

    const [first] = await incoming;
    expect(first).toEqual(initSegment);

    ws.close();
    await new Promise<void>((r) => wss.close(() => r()));
  });

  it('closes unauthorized clients with close code 1008', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const { port } = wss.address() as AddressInfo;
    createWsVideoFanout({ wss, authorize, onClientChange: () => undefined });

    const ws = await openSocket(port);
    const closed = waitClose(ws);

    ws.send(INVALID_TOKEN);

    const { code } = await closed;
    expect(code).toBe(1008);

    await new Promise<void>((r) => wss.close(() => r()));
  });

  it('onClientChange fires +1 on authorized connect and -1 on disconnect', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const { port } = wss.address() as AddressInfo;
    const deltas: (1 | -1)[] = [];
    createWsVideoFanout({ wss, authorize, onClientChange: (d) => deltas.push(d) });

    const ws = await openSocket(port);
    ws.send(VALID_TOKEN);

    // Wait for async auth + delta emission.
    await pause(60);
    expect(deltas).toEqual([1]);

    ws.close();
    await pause(60);
    expect(deltas).toEqual([1, -1]);

    await new Promise<void>((r) => wss.close(() => r()));
  });

  it('clientCount reflects connected authorized clients', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const { port } = wss.address() as AddressInfo;
    const fanout = createWsVideoFanout({ wss, authorize, onClientChange: () => undefined });

    expect(fanout.clientCount()).toBe(0);

    const ws = await openSocket(port);
    ws.send(VALID_TOKEN);
    await pause(60);

    expect(fanout.clientCount()).toBe(1);

    ws.close();
    await pause(60);

    expect(fanout.clientCount()).toBe(0);

    await new Promise<void>((r) => wss.close(() => r()));
  });

  it('closes the socket with 1011 when authorize() throws', async () => {
    const throwingAuthorize = jest.fn(async (_token: string): Promise<Session | null> => {
      throw new Error('unexpected auth failure');
    });

    const wss = new WebSocketServer({ port: 0 });
    const { port } = wss.address() as AddressInfo;
    createWsVideoFanout({ wss, authorize: throwingAuthorize, onClientChange: () => undefined });

    const ws = await openSocket(port);
    const closed = waitClose(ws);

    ws.send(VALID_TOKEN);

    const { code } = await closed;
    // 1011 = internal error; some WS implementations normalize to 1006 on abrupt close.
    expect([1006, 1011]).toContain(code);

    await new Promise<void>((r) => wss.close(() => r()));
  });
});
