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

  it('warns and does not throw when the underlying append fails', async () => {
    const warnings: string[] = [];
    const audit = createHmacAuditLog(join('Z:', 'no', 'commands.log'), 'secret', {
      warn: (m: string) => warnings.push(m),
    });
    await expect(audit.append('admin', 'X')).resolves.toBeUndefined();
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toMatch(/audit/i);
  });

  it('silently ignores failures when no logger is provided (default no-op warn)', async () => {
    // Exercises the SILENT.warn no-op: error path reached without an injected logger.
    const audit = createHmacAuditLog(join('Z:', 'no', 'commands.log'), 'secret');
    await expect(audit.append('admin', 'X')).resolves.toBeUndefined();
  });
});
