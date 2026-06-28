import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Result, ok, err, isOk, isErr } from '../result/result';

export interface LogInput {
  readonly user: string;
  readonly message: string;
}

export interface LogEntry extends LogInput {
  readonly timestamp: string;
  readonly prevHash: string;
  readonly hmac: string;
}

const GENESIS = 'GENESIS';

const computeHmac = (
  secret: string,
  parts: Pick<LogEntry, 'timestamp' | 'user' | 'message' | 'prevHash'>,
): string =>
  createHmac('sha256', secret)
    .update(JSON.stringify([parts.timestamp, parts.user, parts.message, parts.prevHash]))
    .digest('hex');

const readEntries = async (file: string): Promise<Result<LogEntry[], string>> => {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return ok([]);
    throw e;
  }
  if (raw.trimEnd().length === 0) return ok([]);
  try {
    return ok(raw.trimEnd().split('\n').map((line) => JSON.parse(line) as LogEntry));
  } catch {
    return err('log file contains invalid JSON');
  }
};

// Single-writer only: concurrent calls will produce entries with the same
// prevHash, breaking the chain. Use an external queue/mutex for multi-writer scenarios.
export const appendEntry = async (
  file: string,
  secret: string,
  input: LogInput,
): Promise<Result<void, string>> => {
  const entriesResult = await readEntries(file);
  if (isErr(entriesResult)) return entriesResult;
  const entries = entriesResult.value;
  const last = entries[entries.length - 1];
  const prevHash = last !== undefined ? last.hmac : GENESIS;
  const timestamp = new Date().toISOString();
  const hmac = computeHmac(secret, { timestamp, user: input.user, message: input.message, prevHash });
  const entry: LogEntry = { timestamp, user: input.user, message: input.message, prevHash, hmac };
  try {
    await mkdir(dirname(file), { recursive: true });
    await appendFile(file, JSON.stringify(entry) + '\n', 'utf8');
    return ok(undefined);
  } catch (error) {
    return err(error instanceof Error ? error.message : 'append failed');
  }
};

export const verifyChain = async (file: string, secret: string): Promise<Result<number, string>> => {
  const entriesResult = await readEntries(file);
  if (isErr(entriesResult)) return entriesResult;
  const entries = entriesResult.value;
  let prevHash = GENESIS;
  for (let i = 0; i < entries.length; i += 1) {
    // e is LogEntry | undefined per noUncheckedIndexedAccess, but the loop bound
    // guarantees it is always defined — cast via non-null assertion is safe here.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const e = entries[i]!;
    if (e.prevHash !== prevHash) return err(`broken chain at entry ${i}`);
    const expected = computeHmac(secret, {
      timestamp: e.timestamp,
      user: e.user,
      message: e.message,
      prevHash: e.prevHash,
    });
    try {
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(e.hmac, 'hex');
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return err(`tampered entry at index ${i}`);
      }
    } catch {
      return err(`tampered entry at index ${i}`);
    }
    prevHash = e.hmac;
  }
  return ok(entries.length);
};
