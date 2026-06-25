// Unit tests for api/control-socket.ts
// Stubs WebSocket with a controllable fake class to simulate open/message/close/error events.

jest.mock('../lib/env', () => ({
  env: { serverBHttp: 'http://test-server', serverBWs: 'ws://test-b', serverAWs: 'ws://test-a' },
}));

import { openControlSocket, ControlSocketHandlers } from './control-socket';
import { Command } from '@vss/shared';

// Controllable WebSocket fake that records sent messages and exposes emit().
class FakeWS {
  static last: FakeWS;
  private listeners: Record<string, ((e: unknown) => void)[]> = {};
  sent: string[] = [];
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeWS.last = this;
  }

  addEventListener(type: string, cb: (e: unknown) => void): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(cb);
  }

  emit(type: string, event?: unknown): void {
    (this.listeners[type] ?? []).forEach((cb) => cb(event));
  }

  send(data: string): void {
    this.sent.push(data);
  }

  // Triggers the registered 'close' listener — matching real WebSocket behavior.
  close(): void {
    this.emit('close');
  }
}

beforeEach(() => {
  (globalThis as unknown as Record<string, unknown>).WebSocket = FakeWS;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('openControlSocket', () => {
  const makeHandlers = (): {
    handlers: ControlSocketHandlers;
    onResponse: jest.Mock;
    onConnectionError: jest.Mock;
  } => {
    const onResponse = jest.fn();
    const onConnectionError = jest.fn();
    return { handlers: { onResponse, onConnectionError }, onResponse, onConnectionError };
  };

  it('connects to the configured WS URL', () => {
    const { handlers } = makeHandlers();
    openControlSocket('jwt', handlers);
    expect(FakeWS.last.url).toBe('ws://test-b');
  });

  it('sends an auth message when the WebSocket opens', () => {
    const { handlers } = makeHandlers();
    openControlSocket('my-jwt', handlers);

    FakeWS.last.emit('open');

    expect(FakeWS.last.sent).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sent = JSON.parse(FakeWS.last.sent[0]!) as Record<string, unknown>;
    expect(sent.type).toBe('auth');
    expect(sent.token).toBe('my-jwt');
  });

  it('dispatches onResponse with ok=true for a successful response message', () => {
    const { handlers, onResponse } = makeHandlers();
    openControlSocket('jwt', handlers);

    FakeWS.last.emit('message', {
      data: JSON.stringify({ type: 'response', ok: true, text: 'video started' }),
    });

    expect(onResponse).toHaveBeenCalledWith(true, 'video started');
  });

  it('dispatches onResponse with ok=false for a failed response message', () => {
    const { handlers, onResponse } = makeHandlers();
    openControlSocket('jwt', handlers);

    FakeWS.last.emit('message', {
      data: JSON.stringify({ type: 'response', ok: false, text: 'not allowed' }),
    });

    expect(onResponse).toHaveBeenCalledWith(false, 'not allowed');
  });

  it('dispatches onConnectionError for a server error message', () => {
    const { handlers, onConnectionError } = makeHandlers();
    openControlSocket('jwt', handlers);

    FakeWS.last.emit('message', {
      data: JSON.stringify({ type: 'error', text: 'server-side error' }),
    });

    expect(onConnectionError).toHaveBeenCalledWith('server-side error');
  });

  it('dispatches onConnectionError with "malformed server message" for schema-invalid JSON', () => {
    const { handlers, onConnectionError } = makeHandlers();
    openControlSocket('jwt', handlers);

    // Valid JSON but not matching the ControlServerMessage schema
    FakeWS.last.emit('message', {
      data: JSON.stringify({ type: 'unknown_type', payload: 'whatever' }),
    });

    expect(onConnectionError).toHaveBeenCalledWith('malformed server message');
  });

  it('dispatches onConnectionError with "control connection closed" when the connection closes', () => {
    const { handlers, onConnectionError } = makeHandlers();
    const socket = openControlSocket('jwt', handlers);

    // socket.close() calls ws.close() which fires the 'close' event via FakeWS.close().
    socket.close();

    expect(onConnectionError).toHaveBeenCalledWith('control connection closed');
  });

  it('dispatches onConnectionError with "control connection error" on a WS error event', () => {
    const { handlers, onConnectionError } = makeHandlers();
    openControlSocket('jwt', handlers);

    FakeWS.last.emit('error');

    expect(onConnectionError).toHaveBeenCalledWith('control connection error');
  });

  it('send() transmits a JSON-encoded command message', () => {
    const { handlers } = makeHandlers();
    const socket = openControlSocket('jwt', handlers);
    FakeWS.last.emit('open'); // consume the auth message at index 0

    socket.send('GET_STATUS' as Command);

    expect(FakeWS.last.sent).toHaveLength(2);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sent = JSON.parse(FakeWS.last.sent[1]!) as Record<string, unknown>;
    expect(sent.type).toBe('command');
    expect(sent.command).toBe('GET_STATUS');
  });

  it('sendEncrypted() transmits an encrypted payload message', () => {
    const { handlers } = makeHandlers();
    const socket = openControlSocket('jwt', handlers);
    FakeWS.last.emit('open'); // consume the auth message at index 0

    socket.sendEncrypted('base64cipher==');

    expect(FakeWS.last.sent).toHaveLength(2);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sent = JSON.parse(FakeWS.last.sent[1]!) as Record<string, unknown>;
    expect(sent.type).toBe('encrypted');
    expect(sent.payload).toBe('base64cipher==');
  });
});
