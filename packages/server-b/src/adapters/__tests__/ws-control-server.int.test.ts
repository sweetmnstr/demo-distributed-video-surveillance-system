import { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import { ok, err } from '@vss/shared';
import { startControlServer } from '../ws-control-server';
import type { SessionStore } from '../../ports/session-store';
import type { AuditLog } from '../../ports/audit-log';
import type { CommandForwarder } from '../../ports/command-forwarder';
import type { TokenVerifier } from '../../ports/token-verifier';
import type { CommandCipher } from '@vss/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const openClient = (port: number): Promise<WebSocket> =>
  new Promise<WebSocket>((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => resolve(ws));
  });

// Resolves with the next parsed JSON message received on the socket.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic test helper
const next = (ws: WebSocket): Promise<any> =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic test helper
  new Promise<any>((resolve) => ws.once('message', (m) => resolve(JSON.parse(String(m)))));

// Resolves when the socket closes.
const closed = (ws: WebSocket): Promise<void> =>
  new Promise<void>((resolve) => ws.on('close', () => resolve()));

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

const makeSessionStore = (overrides: Partial<SessionStore> = {}): SessionStore => ({
  create: async () => undefined,
  isActive: async () => true,
  revoke: async () => undefined,
  ...overrides,
});

const makeAuditLog = (overrides: Partial<AuditLog> = {}): AuditLog => ({
  append: async () => undefined,
  ...overrides,
});

const makeVerifier = (goodToken: string = 'good'): TokenVerifier => ({
  verify: async (t: string) =>
    t === goodToken
      ? ok({ sub: 'admin', role: 'operator' as const, jti: 'jti-1', iat: 0, exp: 9999999999 })
      : err('invalid'),
});

const makeForwarder = (): CommandForwarder => ({
  forward: async () => ({ ok: true, text: 'done' }),
});

const makeCipher = (overrides: Partial<CommandCipher> = {}): CommandCipher => ({
  getPublicKey: async () => 'pubkey',
  // Note: decrypt stub ignores the Buffer parameter and returns a fixed value.
  // This is acceptable in integration test context where we test the routing logic,
  // not the cipher implementation. CommandCipher has no encrypt method.
  decrypt: async () => 'GET_STATUS',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ws-control-server (integration)', () => {
  let wss: WebSocketServer;
  let port: number;

  // Build a fully-wired server with optional dep overrides for each test.
  const startServer = (
    cipherOverride?: Partial<CommandCipher>,
    forwarderOverride?: Partial<CommandForwarder>,
  ): void => {
    const sessions = makeSessionStore();
    startControlServer({
      wss,
      auth: {
        verifier: makeVerifier('good'),
        sessions,
      },
      process: {
        audit: makeAuditLog(),
        forwarder: forwarderOverride
          ? { ...makeForwarder(), ...forwarderOverride }
          : makeForwarder(),
      },
      logoutDeps: {
        sessions,
        audit: makeAuditLog(),
      },
      cipher: makeCipher(cipherOverride),
    });
  };

  beforeEach((done) => {
    wss = new WebSocketServer({ port: 0 }, () => {
      port = (wss.address() as AddressInfo).port;
      done();
    });
  });

  afterEach((done) => {
    wss.close(() => done());
  });

  // -------------------------------------------------------------------------
  // Branch: invalid JSON → error response
  // -------------------------------------------------------------------------
  it('returns an error for invalid JSON', async () => {
    startServer();
    const ws = await openClient(port);
    ws.send('not json at all');
    const reply = await next(ws);
    expect(reply.type).toBe('error');
    expect(reply.text).toBe('invalid message');
    ws.close();
  });

  // -------------------------------------------------------------------------
  // Branch: schema-invalid message (unknown `type`) → error
  // -------------------------------------------------------------------------
  it('returns an error for a schema-invalid message (unknown type)', async () => {
    startServer();
    const ws = await openClient(port);
    ws.send(JSON.stringify({ type: 'bogus', payload: 'x' }));
    const reply = await next(ws);
    expect(reply.type).toBe('error');
    expect(reply.text).toBe('invalid message');
    ws.close();
  });

  // -------------------------------------------------------------------------
  // Branch: unauthenticated command → "not authenticated"
  // -------------------------------------------------------------------------
  it('rejects a command when not yet authenticated', async () => {
    startServer();
    const ws = await openClient(port);
    ws.send(JSON.stringify({ type: 'command', command: 'GET_STATUS' }));
    const reply = await next(ws);
    expect(reply.type).toBe('error');
    expect(reply.text).toBe('not authenticated');
    ws.close();
  });

  // -------------------------------------------------------------------------
  // Branch: bad auth token → "unauthorized" then close
  // -------------------------------------------------------------------------
  it('sends unauthorized and closes when the token is invalid', async () => {
    startServer();
    const ws = await openClient(port);
    let closeCode: number | undefined;
    ws.on('close', (c) => { closeCode = c; });
    ws.send(JSON.stringify({ type: 'auth', token: 'bad-token' }));
    const reply = await next(ws);
    expect(reply.type).toBe('error');
    expect(reply.text).toBe('unauthorized');
    // Server must close the socket with code 1008 (policy violation) after rejecting auth.
    await new Promise<void>((resolve) => ws.on('close', () => resolve()));
    expect(closeCode).toBe(1008);
  });

  // -------------------------------------------------------------------------
  // Branch: good token → "authenticated" response
  // -------------------------------------------------------------------------
  it('authenticates successfully with a good token', async () => {
    startServer();
    const ws = await openClient(port);
    ws.send(JSON.stringify({ type: 'auth', token: 'good' }));
    const reply = await next(ws);
    expect(reply.type).toBe('response');
    expect(reply.ok).toBe(true);
    expect(reply.text).toBe('authenticated');
    ws.close();
  });

  // -------------------------------------------------------------------------
  // Branch: command routing after auth (GET_STATUS)
  // -------------------------------------------------------------------------
  it('routes a plaintext command after successful authentication', async () => {
    startServer();
    const ws = await openClient(port);

    ws.send(JSON.stringify({ type: 'auth', token: 'good' }));
    await next(ws); // consume auth reply

    ws.send(JSON.stringify({ type: 'command', command: 'GET_STATUS' }));
    const reply = await next(ws);
    expect(reply.type).toBe('response');
    expect(reply.ok).toBe(true);
    ws.close();
  });

  // -------------------------------------------------------------------------
  // Branch: encrypted command routing after auth
  // -------------------------------------------------------------------------
  it('decrypts and routes an encrypted command after authentication', async () => {
    // cipher.decrypt returns 'GET_STATUS' which is a valid command.
    startServer();
    const ws = await openClient(port);

    ws.send(JSON.stringify({ type: 'auth', token: 'good' }));
    await next(ws); // consume auth reply

    // Payload must be a non-empty base64 string (Zod: min(1)).
    ws.send(JSON.stringify({ type: 'encrypted', payload: 'Y2lwaGVy' }));
    const reply = await next(ws);
    expect(reply.type).toBe('response');
    expect(reply.ok).toBe(true);
    ws.close();
  });

  // -------------------------------------------------------------------------
  // Branch: LOGOUT command → reply + socket close
  // -------------------------------------------------------------------------
  it('handles LOGOUT by sending a response then closing the socket', async () => {
    startServer();
    const ws = await openClient(port);
    const closePromise = closed(ws);

    ws.send(JSON.stringify({ type: 'auth', token: 'good' }));
    await next(ws); // consume auth reply

    ws.send(JSON.stringify({ type: 'command', command: 'LOGOUT' }));
    const reply = await next(ws);
    expect(reply.type).toBe('response');
    expect(reply.ok).toBe(true);

    // Socket must be closed by the server after logout.
    await closePromise;
  });

  // -------------------------------------------------------------------------
  // Branch: decryption error → error response (decryptCommand returns err())
  // -------------------------------------------------------------------------
  it('returns an error when the encrypted payload is not a valid command', async () => {
    // cipher.decrypt returns a string that is not a recognized command.
    startServer({ decrypt: async () => 'NOT_A_COMMAND' });
    const ws = await openClient(port);

    ws.send(JSON.stringify({ type: 'auth', token: 'good' }));
    await next(ws); // consume auth reply

    ws.send(JSON.stringify({ type: 'encrypted', payload: 'Y2lwaGVy' }));
    const reply = await next(ws);
    expect(reply.type).toBe('error');
    ws.close();
  });

  // -------------------------------------------------------------------------
  // Branch: catch → "internal error" (outer try-catch in ws handler)
  //
  // The message handler is `async` with a top-level try-catch. It awaits
  // `authenticateConnection`, so if the session store throws during the `auth`
  // path the rejection propagates to the outer catch, which replies with
  // { type: 'error', text: 'internal error' } and closes the socket (1011).
  // -------------------------------------------------------------------------
  it('sends internal error and closes when sessions.isActive throws during auth', async () => {
    // Wire up a session store whose `isActive` throws — this propagates out of
    // `authenticateConnection` (which is awaited) and into the outer catch.
    const throwingSessions: SessionStore = {
      create: async () => undefined,
      isActive: async () => {
        throw new Error('storage unavailable');
      },
      revoke: async () => undefined,
    };

    startControlServer({
      wss,
      auth: {
        verifier: makeVerifier('good'),
        sessions: throwingSessions,
      },
      process: {
        audit: makeAuditLog(),
        forwarder: makeForwarder(),
      },
      logoutDeps: {
        sessions: throwingSessions,
        audit: makeAuditLog(),
      },
      cipher: makeCipher(),
    });

    const ws = await openClient(port);
    let closeCode: number | undefined;
    ws.on('close', (c) => { closeCode = c; });

    // Sending a valid token triggers the auth path: verifier.verify succeeds,
    // then sessions.isActive throws → outer catch fires.
    ws.send(JSON.stringify({ type: 'auth', token: 'good' }));
    const reply = await next(ws);
    expect(reply.type).toBe('error');
    expect(reply.text).toBe('internal error');

    // Server must close the socket with code 1011 (server error) after catching the unexpected error.
    await new Promise<void>((resolve) => ws.on('close', () => resolve()));
    expect(closeCode).toBe(1011);
  });
});
