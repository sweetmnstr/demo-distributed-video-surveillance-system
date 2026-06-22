import { authenticateConnection } from './authenticate-connection';
import { ok, err, isOk, isErr, JwtClaims } from '@vss/shared';

const claims: JwtClaims = { sub: 'op', role: 'operator', jti: 'jti-1', iat: 0, exp: 9999999999 };
const sessions = (active: boolean) => ({ create: async () => {}, isActive: async () => active, revoke: async () => {} });

describe('authenticateConnection', () => {
  it('accepts a valid, active session', async () => {
    const r = await authenticateConnection('tok', { verifier: { verify: async () => ok(claims) }, sessions: sessions(true) });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value).toEqual({ login: 'op', role: 'operator', jti: 'jti-1' });
  });
  it('rejects an invalid token', async () => {
    const r = await authenticateConnection('bad', { verifier: { verify: async () => err('invalid token') }, sessions: sessions(true) });
    expect(isErr(r)).toBe(true);
  });
  it('rejects a revoked session', async () => {
    const r = await authenticateConnection('tok', { verifier: { verify: async () => ok(claims) }, sessions: sessions(false) });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error).toContain('revoked');
  });
});
