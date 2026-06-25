// Unit tests for src/lib/env.ts
// Verifies that env exports correct defaults when VITE_* process.env vars are
// absent, and that it reads overrides when they are set.
//
// Access process.env via globalThis cast to avoid TypeScript DOM-lib errors
// (the web-client tsconfig targets the browser and does not include @types/node,
// but process is real in the Jest/Node runtime).
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const proc = (globalThis as any)['process'].env as Record<string, string | undefined>;

describe('env', () => {
  const originalBHttp = proc['VITE_SERVER_B_HTTP'];
  const originalBWs = proc['VITE_SERVER_B_WS'];
  const originalAWs = proc['VITE_SERVER_A_WS'];

  beforeEach(() => {
    jest.resetModules();
    delete proc['VITE_SERVER_B_HTTP'];
    delete proc['VITE_SERVER_B_WS'];
    delete proc['VITE_SERVER_A_WS'];
  });

  afterAll(() => {
    // Restore original values so other test files are not affected.
    if (originalBHttp !== undefined) proc['VITE_SERVER_B_HTTP'] = originalBHttp;
    if (originalBWs !== undefined) proc['VITE_SERVER_B_WS'] = originalBWs;
    if (originalAWs !== undefined) proc['VITE_SERVER_A_WS'] = originalAWs;
  });

  it('returns default URLs when VITE_* env vars are not set', async () => {
    const { env } = await import('./env');

    expect(env.serverBHttp).toBe('http://127.0.0.1:3000');
    expect(env.serverBWs).toBe('ws://127.0.0.1:3002');
    expect(env.serverAWs).toBe('ws://127.0.0.1:2222');
  });

  it('reads VITE_SERVER_B_HTTP override from process.env', async () => {
    proc['VITE_SERVER_B_HTTP'] = 'http://custom-host:9000';

    const { env } = await import('./env');

    expect(env.serverBHttp).toBe('http://custom-host:9000');
  });

  it('reads VITE_SERVER_B_WS override from process.env', async () => {
    proc['VITE_SERVER_B_WS'] = 'ws://custom-host:9001';

    const { env } = await import('./env');

    expect(env.serverBWs).toBe('ws://custom-host:9001');
  });

  it('reads VITE_SERVER_A_WS override from process.env', async () => {
    proc['VITE_SERVER_A_WS'] = 'ws://custom-host:9002';

    const { env } = await import('./env');

    expect(env.serverAWs).toBe('ws://custom-host:9002');
  });

  it('falls back to empty env when globalThis.process is absent (browser-like env)', async () => {
    // Simulate a browser context where process is not defined.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    const saved = g['process'];
    g['process'] = undefined;

    try {
      const { env } = await import('./env');
      // All values should be defaults since procEnv falls back to {}.
      expect(env.serverBHttp).toBe('http://127.0.0.1:3000');
      expect(env.serverBWs).toBe('ws://127.0.0.1:3002');
      expect(env.serverAWs).toBe('ws://127.0.0.1:2222');
    } finally {
      g['process'] = saved;
    }
  });
});
