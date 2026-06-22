import { Command } from '@vss/shared';
import { CommandReply } from '../reply';

// Forwards a command over the A↔B channel and resolves with Server A's reply.
// When the channel is down it resolves ok:false (rejected, never queued).
export interface CommandForwarder {
  forward(command: Command): Promise<CommandReply>;
}
