import Redis from 'ioredis';
import { SessionStore } from '../ports/session-store';

// A session is active iff Server B still holds `session:{jti}` in Redis.
// LOGOUT deletes that key, so a revoked token immediately fails the check.
export const createRedisSessionStore = (redisUrl: string): SessionStore => {
  const redis = new Redis(redisUrl);
  return {
    async isActive(jti) {
      const value = await redis.get(`session:${jti}`);
      return value !== null;
    },
  };
};
