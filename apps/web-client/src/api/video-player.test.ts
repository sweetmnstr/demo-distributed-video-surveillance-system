// Unit tests for api/video-player.ts
// Stubs MediaSource, SourceBuffer, WebSocket, URL.createObjectURL, and URL.revokeObjectURL
// to drive the full MSE lifecycle without a real browser.

jest.mock('../lib/env', () => ({
  env: { serverBHttp: 'http://test-server', serverBWs: 'ws://test-b', serverAWs: 'ws://test-a' },
}));

import { attachVideo } from './video-player';

// A SourceBuffer stub with controllable `updating` and per-event listeners.
class FakeSourceBuffer {
  static last: FakeSourceBuffer;
  updating = false;
  private listeners: Record<string, Array<() => void>> = {};
  readonly appended: Uint8Array[] = [];

  constructor() {
    FakeSourceBuffer.last = this;
  }

  addEventListener(type: string, cb: () => void): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(cb);
  }

  appendBuffer(chunk: Uint8Array): void {
    this.appended.push(chunk);
    this.updating = true;
  }

  // Helper: fires all registered listeners for a given event type.
  emit(type: string): void {
    (this.listeners[type] ?? []).forEach((cb) => cb());
  }
}

// A MediaSource stub that delegates addSourceBuffer() to FakeSourceBuffer.
class FakeMediaSource {
  static last: FakeMediaSource;
  readyState: 'open' | 'closed' | 'ended' = 'open';
  private listeners: Record<string, Array<() => void>> = {};
  readonly endOfStream = jest.fn();

  constructor() {
    FakeMediaSource.last = this;
  }

  addEventListener(type: string, cb: () => void): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(cb);
  }

  addSourceBuffer(_mime: string): FakeSourceBuffer {
    return new FakeSourceBuffer();
  }

  // Helper: fires all registered listeners for a given event type.
  emit(type: string): void {
    (this.listeners[type] ?? []).forEach((cb) => cb());
  }
}

// A WebSocket stub that records sent payloads.
class FakeWS {
  static last: FakeWS;
  binaryType = '';
  private listeners: Record<string, Array<(e: unknown) => void>> = {};
  readonly sent: unknown[] = [];
  readonly close = jest.fn();

  constructor() {
    FakeWS.last = this;
  }

  addEventListener(type: string, cb: (e: unknown) => void): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(cb);
  }

  send(data: unknown): void {
    this.sent.push(data);
  }

  // Helper: fires all registered listeners for a given event type.
  emit(type: string, event?: unknown): void {
    (this.listeners[type] ?? []).forEach((cb) => cb(event));
  }
}

// Install fakes before each test so state is fresh.
beforeEach(() => {
  (globalThis as unknown as Record<string, unknown>).MediaSource = FakeMediaSource;
  (globalThis as unknown as Record<string, unknown>).WebSocket = FakeWS;
  (globalThis as unknown as Record<string, unknown>).URL = {
    createObjectURL: jest.fn(() => 'blob:fake'),
    revokeObjectURL: jest.fn(),
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Helper: build a minimal HTMLVideoElement stub.
const makeVideoEl = (): HTMLVideoElement => ({ src: '' } as HTMLVideoElement);

// Helper: open the MediaSource and WebSocket so tests start from a ready state.
const openAll = (): { video: HTMLVideoElement; stop: () => void } => {
  const video = makeVideoEl();
  const stop = attachVideo(video, 'test-jwt');
  FakeMediaSource.last.emit('sourceopen');
  FakeWS.last.emit('open');
  return { video, stop };
};

describe('attachVideo', () => {
  it('sets video.src to the object URL returned by URL.createObjectURL', () => {
    const video = makeVideoEl();
    attachVideo(video, 'jwt');
    expect(video.src).toBe('blob:fake');
  });

  it('sends the JWT token over WebSocket when the connection opens', () => {
    const { stop } = openAll();
    expect(FakeWS.last.sent).toContain('test-jwt');
    stop();
  });

  it('sets binaryType to arraybuffer on the WebSocket', () => {
    attachVideo(makeVideoEl(), 'jwt');
    expect(FakeWS.last.binaryType).toBe('arraybuffer');
  });

  it('appends a binary message immediately when the SourceBuffer is idle', () => {
    const { stop } = openAll();
    const chunk = new Uint8Array([1, 2, 3]);
    FakeWS.last.emit('message', { data: chunk.buffer });

    // The MSE queue should append immediately since updating starts as false.
    expect(FakeSourceBuffer.last.appended).toHaveLength(1);
    expect(FakeSourceBuffer.last.appended[0]).toEqual(chunk);
    stop();
  });

  it('queues a second fragment while the first is still appending, then drains on updateend', () => {
    const { stop } = openAll();
    const first = new Uint8Array([10]);
    const second = new Uint8Array([20]);

    // First message: appended immediately, buffer becomes busy.
    FakeWS.last.emit('message', { data: first.buffer });
    expect(FakeSourceBuffer.last.appended).toHaveLength(1);

    // Second message arrives while buffer is still busy — must be queued, not appended yet.
    FakeWS.last.emit('message', { data: second.buffer });
    expect(FakeSourceBuffer.last.appended).toHaveLength(1);

    // updateend fires: the queue drains and the second chunk gets appended.
    FakeSourceBuffer.last.emit('updateend');
    expect(FakeSourceBuffer.last.appended).toHaveLength(2);
    expect(FakeSourceBuffer.last.appended[1]).toEqual(second);

    stop();
  });

  it('does nothing on a binary message received before sourceopen fires', () => {
    // Do NOT emit sourceopen — buffer is null.
    const video = makeVideoEl();
    attachVideo(video, 'jwt');
    FakeWS.last.emit('open');
    FakeWS.last.emit('message', { data: new Uint8Array([99]).buffer });
    // No SourceBuffer was created, so FakeSourceBuffer.last is whatever it was before.
    // The important thing is that no error is thrown (pump guards with `if (!buffer)`).
    expect(FakeWS.last.sent).toContain('jwt');
  });

  it('updateend with an empty queue transitions back to idle without calling appendBuffer again', () => {
    const { stop } = openAll();
    const chunk = new Uint8Array([5]);

    FakeWS.last.emit('message', { data: chunk.buffer });
    expect(FakeSourceBuffer.last.appended).toHaveLength(1);

    // updateend fires but queue is empty — no additional appendBuffer call.
    FakeSourceBuffer.last.emit('updateend');
    expect(FakeSourceBuffer.last.appended).toHaveLength(1);

    stop();
  });

  it('stop() closes the WebSocket', () => {
    const { stop } = openAll();
    stop();
    expect(FakeWS.last.close).toHaveBeenCalledTimes(1);
  });

  it('stop() calls endOfStream when readyState is "open"', () => {
    const { stop } = openAll();
    FakeMediaSource.last.readyState = 'open';
    stop();
    expect(FakeMediaSource.last.endOfStream).toHaveBeenCalledTimes(1);
  });

  it('stop() skips endOfStream when readyState is not "open"', () => {
    const { stop } = openAll();
    FakeMediaSource.last.readyState = 'closed';
    stop();
    expect(FakeMediaSource.last.endOfStream).not.toHaveBeenCalled();
  });

  it('stop() calls URL.revokeObjectURL with the blob URL and clears video.src', () => {
    const { video, stop } = openAll();
    stop();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fakeUrl = (globalThis as any).URL as Record<string, jest.Mock>;
    expect(fakeUrl['revokeObjectURL']).toHaveBeenCalledWith('blob:fake');
    expect(video.src).toBe('');
  });
});
