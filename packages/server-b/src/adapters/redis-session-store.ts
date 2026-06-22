import Redis from 'ioredis';
import { SessionStore } from '../ports/session-store';

// Sessions live under session:{jti} with a TTL matching the JWT. LOGOUT deletes
// the key, so Server A's revocation check fails immediately afterwards.
export const createRedisSessionStore = (redisUrl: string): SessionStore => {
  const redis = new Redis(redisUrl);
  return {
    async create(jti, session, ttlSeconds) {
      await redis.set(`session:${jti}`, JSON.stringify(session), 'EX', ttlSeconds);
    },
    async isActive(jti) {
      return (await redis.get(`session:${jti}`)) !== null;
    },
    async revoke(jti) {
      await redis.del(`session:${jti}`);
    },
  };
};
