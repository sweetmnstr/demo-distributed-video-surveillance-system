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
