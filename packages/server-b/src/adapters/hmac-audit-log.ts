import { appendEntry } from '@vss/shared';
import { AuditLog } from '../ports/audit-log';

export const createHmacAuditLog = (logPath: string, secret: string): AuditLog => ({
  // appendEntry returns Result<void,string>; the AuditLog port expects Promise<void>.
  // We await and discard the Result — write errors are non-fatal for audit logging.
  async append(user, message) {
    await appendEntry(logPath, secret, { user, message });
  },
});
