import { isAbsolute, resolve } from 'node:path';
import { loadServerBConfig } from '../config';

const validEnv = {
  HTTP_PORT: '3000',
  CONTROL_WS_PORT: '3000',
  INTERSERVER_WS_PORT: '3001',
  PRIVATE_KEY_PATH: 'config/keys/private.pem',
  PUBLIC_KEY_PATH: 'config/keys/public.pem',
  USERS_PATH: 'config/users.json',
  COMMANDS_LOG_PATH: 'config/commands.log',
  HMAC_SECRET: 's3cret',
  REDIS_URL: 'redis://127.0.0.1:6379',
  JWT_TTL_SECONDS: '3600',
};

// __dirname here is packages/server-b/src/__tests__; repo root is 4 levels up
const REPO_ROOT = resolve(__dirname, '../../../..');

describe('loadServerBConfig', () => {
  it('parses a complete env into typed config', () => {
    const cfg = loadServerBConfig(validEnv);
    expect(cfg.httpPort).toBe(3000);
    expect(cfg.jwtTtlSeconds).toBe(3600);
    expect(cfg.hmacSecret).toBe('s3cret');
  });
  it('throws when a required variable is missing', () => {
    const { HMAC_SECRET, ...incomplete } = validEnv;
    expect(() => loadServerBConfig(incomplete)).toThrow();
  });
  it('throws when a numeric variable is not a number', () => {
    expect(() => loadServerBConfig({ ...validEnv, HTTP_PORT: 'abc' })).toThrow();
  });
});

describe('loadServerBConfig — path resolution', () => {
  it('resolves a relative commandsLogPath against the repo root, not cwd', () => {
    const cfg = loadServerBConfig({ ...validEnv, COMMANDS_LOG_PATH: 'config/commands.log' });
    const expected = resolve(REPO_ROOT, 'config/commands.log');
    expect(cfg.commandsLogPath).toBe(expected);
  });

  it('passes an absolute commandsLogPath through unchanged', () => {
    // Construct a platform-safe absolute path from __dirname so it is
    // genuinely absolute on both Windows and POSIX.
    const absPath = resolve(__dirname, 'absolute-commands.log');
    const cfg = loadServerBConfig({ ...validEnv, COMMANDS_LOG_PATH: absPath });
    expect(cfg.commandsLogPath).toBe(absPath);
  });
});

describe('loadServerBConfig — cipher selection', () => {
  it('defaults cipherImpl to node when CIPHER_IMPL is absent', () => {
    expect(loadServerBConfig(validEnv).cipherImpl).toBe('node');
  });
  it('accepts an explicit native selection', () => {
    expect(loadServerBConfig({ ...validEnv, CIPHER_IMPL: 'native' }).cipherImpl).toBe('native');
  });
  it('accepts an explicit tpm selection', () => {
    expect(loadServerBConfig({ ...validEnv, CIPHER_IMPL: 'tpm' }).cipherImpl).toBe('tpm');
  });
  it('rejects an unknown cipher implementation', () => {
    expect(() => loadServerBConfig({ ...validEnv, CIPHER_IMPL: 'rot13' })).toThrow();
  });
});

describe('loadServerBConfig — TPM key name', () => {
  it('defaults tpmKeyName to vss-tpm-command-key when TPM_KEY_NAME is absent', () => {
    expect(loadServerBConfig(validEnv).tpmKeyName).toBe('vss-tpm-command-key');
  });
  it('honors an explicit TPM_KEY_NAME override', () => {
    expect(loadServerBConfig({ ...validEnv, TPM_KEY_NAME: 'custom-key' }).tpmKeyName).toBe('custom-key');
  });
});
