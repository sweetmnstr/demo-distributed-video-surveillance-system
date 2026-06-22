import { Session } from '@vss/shared';
import { SessionStore } from '../ports/session-store';
import { AuditLog } from '../ports/audit-log';
import { CommandReply } from '../reply';

export interface LogoutDeps {
  readonly sessions: SessionStore;
  readonly audit: AuditLog;
}

export const logout = async (session: Session, deps: LogoutDeps): Promise<CommandReply> => {
  await deps.sessions.revoke(session.jti);
  await deps.audit.append(session.login, 'LOGOUT');
  return { ok: true, text: 'logged out' };
};
