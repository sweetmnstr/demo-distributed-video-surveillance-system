// Centralizes Vite env access in a way that works under both Vite and ts-jest.
//
// Strategy: read from globalThis.process.env (available in Node/Jest as-is, and
// in Vite browser builds via the vite.config define block that maps VITE_* vars
// to process.env.*). Accessing process via globalThis with a cast avoids any
// TypeScript DOM-lib type error — no @types/node dependency required.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const procEnv: Record<string, string | undefined> = (globalThis as any)['process']?.env ?? {};

function read(key: string): string | undefined {
  return procEnv[key];
}

export const env = {
  serverBHttp: read('VITE_SERVER_B_HTTP') ?? 'http://127.0.0.1:3000',
  serverBWs: read('VITE_SERVER_B_WS') ?? 'ws://127.0.0.1:3002',
  serverAWs: read('VITE_SERVER_A_WS') ?? 'ws://127.0.0.1:2222',
};
