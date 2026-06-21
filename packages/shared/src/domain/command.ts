import { Result, ok, err } from '../result/result';

export const COMMANDS = ['START_VIDEO', 'STOP_VIDEO', 'GET_STATUS', 'LOGOUT'] as const;
export type Command = (typeof COMMANDS)[number];

const isCommand = (value: string): value is Command =>
  COMMANDS.some((c) => c === value);

export const parseCommand = (raw: string): Result<Command, string> => {
  const normalized = raw.trim().toUpperCase();
  if (normalized.length === 0) return err('empty command');
  if (!isCommand(normalized)) return err(`unknown command: ${normalized}`);
  return ok(normalized);
};
