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

// Import the mocked Redis constructor so we can seed keys directly.
import Redis from 'ioredis';
import { createRedisSessionStore } from '../redis-session-store';

describe('redis-session-store (server-a)', () => {
  // Server A's adapter is read-only: it checks whether `session:{jti}` exists.
  // We seed keys via a raw ioredis-mock client that shares in-memory state
  // with the client created inside createRedisSessionStore (same mock module).

  let seeder: InstanceType<typeof Redis>;

  beforeEach(() => {
    seeder = new Redis('redis://127.0.0.1:6379');
  });

  afterEach(async () => {
    await seeder.flushall();
  });

  it('isActive returns true when the session key exists', async () => {
    await seeder.set('session:jti-live', JSON.stringify({ login: 'alice' }), 'EX', 60);
    const store = createRedisSessionStore('redis://127.0.0.1:6379');
    expect(await store.isActive('jti-live')).toBe(true);
  });

  it('isActive returns false when the session key is absent', async () => {
    const store = createRedisSessionStore('redis://127.0.0.1:6379');
    expect(await store.isActive('jti-gone')).toBe(false);
  });
});
