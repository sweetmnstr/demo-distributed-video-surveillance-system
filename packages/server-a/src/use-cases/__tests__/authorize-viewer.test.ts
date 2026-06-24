import { authorizeViewer } from '../authorize-viewer';
import { ok, err, isOk, isErr, JwtClaims } from '@vss/shared';

const claims: JwtClaims = { sub: 'op', role: 'operator', jti: 'jti-1', iat: 0, exp: 9999999999 };

describe('authorizeViewer', () => {
  it('authorizes a valid, non-revoked token', async () => {
    const r = await authorizeViewer('token', {
      verifier: { verify: async () => ok(claims) },
      sessions: { isActive: async () => true },
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value).toEqual({ login: 'op', role: 'operator', jti: 'jti-1' });
  });
  it('rejects an invalid token without checking the session store', async () => {
    const isActive = jest.fn(async () => true);
    const r = await authorizeViewer('bad', {
      verifier: { verify: async () => err('invalid token') },
      sessions: { isActive },
    });
    expect(isErr(r)).toBe(true);
    expect(isActive).not.toHaveBeenCalled();
  });
  it('rejects a revoked session', async () => {
    const r = await authorizeViewer('token', {
      verifier: { verify: async () => ok(claims) },
      sessions: { isActive: async () => false },
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error).toContain('revoked');
  });
});
