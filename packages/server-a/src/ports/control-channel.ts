import { Command } from '@vss/shared';

// A->B control client. Registers a handler invoked for each command B forwards.
export type CommandHandler = (command: Command, requestId: string) => Promise<{ ok: boolean; text: string }>;

export interface ControlChannel {
  onCommand(handler: CommandHandler): void;
  start(): void;
}
