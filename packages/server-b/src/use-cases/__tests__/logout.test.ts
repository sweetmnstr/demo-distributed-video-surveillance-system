import { logout } from '../logout';
import { Session } from '@vss/shared';

const session: Session = { login: 'op', role: 'operator', jti: 'jti-1' };

describe('logout', () => {
  it('revokes the session, logs LOGOUT, and acknowledges', async () => {
    const revoke = jest.fn(async () => {});
    const append = jest.fn(async () => {});
    const reply = await logout(session, {
      sessions: { create: async () => {}, isActive: async () => true, revoke },
      audit: { append },
    });
    expect(reply.ok).toBe(true);
    expect(revoke).toHaveBeenCalledWith('jti-1');
    expect(append).toHaveBeenCalledWith('op', 'LOGOUT');
  });
});
