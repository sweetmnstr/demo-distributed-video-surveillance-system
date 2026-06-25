// jest.mock must precede imports of the module under test so Jest intercepts
// the ioredis require before the module is evaluated.
jest.mock('ioredis', () => {
  // ioredis-mock v8 exports the constructor as both the module itself and as
  // `.default`; we return the constructor so `new Redis(url)` works the same
  // as with real ioredis.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const IORedisMock = require('ioredis-mock');
  return IORedisMock.default ?? IORedisMock;
});

import { createRedisSessionStore } from '../redis-session-store';

describe('redis-session-store (server-b)', () => {
  it('create → isActive true; revoke → isActive false', async () => {
    const store = createRedisSessionStore('redis://127.0.0.1:6379');
    await store.create('j1', { login: 'alice', role: 'operator' }, 60);
    expect(await store.isActive('j1')).toBe(true);
    await store.revoke('j1');
    expect(await store.isActive('j1')).toBe(false);
  });

  it('isActive is false for an unknown jti', async () => {
    const store = createRedisSessionStore('redis://127.0.0.1:6379');
    expect(await store.isActive('no-such-jti')).toBe(false);
  });
});
