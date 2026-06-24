import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendEntry, verifyChain, LogEntry } from '../hmac-log';
import { isOk, isErr } from '../../result/result';

// appendFile mock — delegates to the real implementation by default;
// individual tests override via mockRejectedValueOnce.
const mockAppendFile = jest.fn(
  (...args: Parameters<typeof import('node:fs/promises').appendFile>) =>
    jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises').appendFile(...args),
);

jest.mock('node:fs/promises', () => ({
  ...jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises'),
  get appendFile() {
    // Re-read the reference on each access so tests that replace mockAppendFile see it.
    return mockAppendFile;
  },
}));

const tmpFile = () => join(mkdtempSync(join(tmpdir(), 'vss-log-')), 'commands.log');
const SECRET = 'test-secret';

describe('HMAC append-only log', () => {
  it('appends entries and verifies an intact chain', async () => {
    const file = tmpFile();
    const r1 = await appendEntry(file, SECRET, { user: 'admin', message: 'STOP_VIDEO' });
    expect(isOk(r1)).toBe(true);
    const r2 = await appendEntry(file, SECRET, { user: 'viewer', message: 'GET_STATUS' });
    expect(isOk(r2)).toBe(true);
    expect(isOk(await verifyChain(file, SECRET))).toBe(true);
  });
  it('detects tampering when an entry is modified', async () => {
    const file = tmpFile();
    await appendEntry(file, SECRET, { user: 'admin', message: 'STOP_VIDEO' });
    const lines = readFileSync(file, 'utf8').trimEnd().split('\n');
    // lines[0] is guaranteed to exist since we just wrote one entry
    const rawLine = lines[0] ?? '';
    const entry = JSON.parse(rawLine);
    entry.message = 'START_VIDEO';
    writeFileSync(file, JSON.stringify(entry) + '\n');
    expect(isErr(await verifyChain(file, SECRET))).toBe(true);
  });
  it('verifies an empty (non-existent) log as intact', async () => {
    expect(isOk(await verifyChain(tmpFile(), SECRET))).toBe(true);
  });
  it('verifies an empty (existing but empty) log file as intact', async () => {
    const file = tmpFile();
    // Create the file but leave it empty — exercises the raw.length === 0 branch
    writeFileSync(file, '', 'utf8');
    expect(isOk(await verifyChain(file, SECRET))).toBe(true);
  });
  it('detects a broken prevHash chain when prevHash field is altered', async () => {
    const file = tmpFile();
    await appendEntry(file, SECRET, { user: 'admin', message: 'START_VIDEO' });
    const lines = readFileSync(file, 'utf8').trimEnd().split('\n');
    const rawLine = lines[0] ?? '';
    const entry = JSON.parse(rawLine);
    // Overwrite prevHash to break the chain linkage
    entry.prevHash = 'CORRUPTED';
    writeFileSync(file, JSON.stringify(entry) + '\n');
    expect(isErr(await verifyChain(file, SECRET))).toBe(true);
  });
  it('detects tampering when only the hmac field is replaced', async () => {
    const file = tmpFile();
    await appendEntry(file, SECRET, { user: 'admin', message: 'START_VIDEO' });
    const lines = readFileSync(file, 'utf8').trimEnd().split('\n');
    const entry = JSON.parse(lines[0] ?? '{}') as LogEntry;
    const tampered = { ...entry, hmac: 'a'.repeat(64) };
    writeFileSync(file, JSON.stringify(tampered) + '\n');
    expect(isErr(await verifyChain(file, SECRET))).toBe(true);
  });
  it('returns err when the log file contains invalid JSON', async () => {
    const file = tmpFile();
    writeFileSync(file, 'not valid json\n');
    expect(isErr(await verifyChain(file, SECRET))).toBe(true);
  });
  it('returns err from appendEntry when log file is corrupted', async () => {
    const file = tmpFile();
    writeFileSync(file, 'not valid json\n');
    const result = await appendEntry(file, SECRET, { user: 'admin', message: 'START_VIDEO' });
    expect(isErr(result)).toBe(true);
  });
  it('returns err when the hmac field is a non-string value', async () => {
    const file = tmpFile();
    await appendEntry(file, SECRET, { user: 'admin', message: 'START_VIDEO' });
    const lines = readFileSync(file, 'utf8').trimEnd().split('\n');
    const entry = JSON.parse(lines[0] ?? '{}') as LogEntry;
    // Overwrite hmac with a non-string to trigger the catch branch in timingSafeEqual
    const broken = { ...entry, hmac: 42 };
    writeFileSync(file, JSON.stringify(broken) + '\n');
    expect(isErr(await verifyChain(file, SECRET))).toBe(true);
  });
  it('returns err when the file cannot be written', async () => {
    mockAppendFile.mockRejectedValueOnce(new Error('ENOSPC: no space left on device'));
    const file = tmpFile();
    const result = await appendEntry(file, SECRET, { user: 'admin', message: 'test' });
    expect(isErr(result)).toBe(true);
  });
  it('returns err with fallback message when appendFile rejects with a non-Error value', async () => {
    // Covers the `error instanceof Error ? ... : 'append failed'` false branch.
    mockAppendFile.mockRejectedValueOnce('disk full');
    const file = tmpFile();
    const result = await appendEntry(file, SECRET, { user: 'admin', message: 'test' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error).toBe('append failed');
  });
});
