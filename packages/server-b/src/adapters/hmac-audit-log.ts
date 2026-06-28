import { appendEntry, isErr, Logger } from '@vss/shared';
import { AuditLog } from '../ports/audit-log';

// Logger surface used here: a single warn channel. Defaults to a no-op so the
// adapter stays usable without a logger, but main.ts injects the real one.
type AuditWarn = Pick<Logger, 'warn'>;
const SILENT: AuditWarn = { warn: () => undefined };

export const createHmacAuditLog = (
  logPath: string,
  secret: string,
  log: AuditWarn = SILENT,
): AuditLog => ({
  // Audit-write failures are non-fatal to request handling but must not be
  // silent: a misconfigured path would otherwise drop the audit trail unseen.
  async append(user, message) {
    const result = await appendEntry(logPath, secret, { user, message });
    if (isErr(result)) log.warn(`audit log append failed: ${result.error}`);
  },
});
