import { loginUser, LoginUserDeps } from './login-user';
import { isOk, isErr, User } from '@vss/shared';

const operator: User = { login: 'op', passwordHash: 'hash', role: 'operator' };

const deps = (over: Partial<LoginUserDeps> = {}): LoginUserDeps => ({
  users: { findByLogin: async () => operator },
  hasher: { compare: async () => true },
  issuer: { issue: async () => 'signed.jwt.token' },
  sessions: { create: async () => {}, isActive: async () => true, revoke: async () => {} },
  ids: { next: () => 'jti-1' },
  ttlSeconds: 3600,
  ...over,
});

describe('loginUser', () => {
  it('issues a token and creates a session for valid credentials', async () => {
    const create = jest.fn(async () => {});
    const r = await loginUser({ login: 'op', password: 'pw' }, deps({
      sessions: { create, isActive: async () => true, revoke: async () => {} },
    }));
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.token).toBe('signed.jwt.token');
    expect(create).toHaveBeenCalledWith('jti-1', { login: 'op', role: 'operator' }, 3600);
  });
  it('rejects an unknown user', async () => {
    const r = await loginUser({ login: 'ghost', password: 'pw' }, deps({ users: { findByLogin: async () => null } }));
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error).toBe('invalid credentials');
  });
  it('rejects a wrong password without issuing a token', async () => {
    const issue = jest.fn(async () => 'x');
    const r = await loginUser({ login: 'op', password: 'bad' }, deps({ hasher: { compare: async () => false }, issuer: { issue } }));
    expect(isErr(r)).toBe(true);
    expect(issue).not.toHaveBeenCalled();
  });
});
