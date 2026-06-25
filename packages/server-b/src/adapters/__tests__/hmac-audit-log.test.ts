import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmacAuditLog } from '../hmac-audit-log';

describe('hmac-audit-log', () => {
  it('appends an entry to the log file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'log-'));
    const file = join(dir, 'commands.log');
    const audit = createHmacAuditLog(file, 'secret');
    await audit.append('admin', 'STOP_VIDEO');
    const raw = await readFile(file, 'utf8');
    expect(raw).toContain('STOP_VIDEO');
  });

  it('does not throw when the underlying append fails', async () => {
    // Point at a path whose parent does not exist; appendEntry returns err and is discarded.
    // On Windows, use a clearly invalid path like Z:\no\commands.log.
    const audit = createHmacAuditLog(join('Z:', 'no', 'commands.log'), 'secret');
    await expect(audit.append('admin', 'X')).resolves.toBeUndefined();
  });
});
