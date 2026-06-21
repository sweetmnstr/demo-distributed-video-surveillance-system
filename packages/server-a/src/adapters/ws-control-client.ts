import { WebSocket } from 'ws';
import { InterServerCommand, InterServerResult } from '@vss/shared';
import { ControlChannel, CommandHandler } from '../ports/control-channel';
import { createReconnectController } from '../net/reconnect';

export interface ControlClientDeps {
  readonly serverBUrl: string;
  readonly backoff: { baseMs: number; capMs: number };
  readonly heartbeatMs: number;
}

// A->B control client: connects to Server B, executes forwarded commands, and
// reconnects with backoff. Protocol-level ping keeps the link alive.
export const createWsControlClient = (deps: ControlClientDeps): ControlChannel => {
  let handler: CommandHandler = async () => ({ ok: false, text: 'no handler' });
  let socket: WebSocket | null = null;
  let heartbeat: NodeJS.Timeout | null = null;

  const controller = createReconnectController({
    backoff: deps.backoff,
    schedule: (fn, ms) => setTimeout(fn, ms),
    connect: () => {
      socket = new WebSocket(deps.serverBUrl);
      socket.on('open', () => {
        controller.onOpen();
        heartbeat = setInterval(() => socket?.ping(), deps.heartbeatMs);
      });
      socket.on('message', async (raw) => {
        try {
          const parsed = InterServerCommand.safeParse(JSON.parse(String(raw)));
          if (!parsed.success) return;
          const reply = await handler(parsed.data.command, parsed.data.requestId);
          const out: InterServerResult = { type: 'result', requestId: parsed.data.requestId, ok: reply.ok, text: reply.text };
          socket?.send(JSON.stringify(out));
        } catch {
          // Discard malformed or unexpected messages silently
        }
      });
      socket.on('close', () => { if (heartbeat) clearInterval(heartbeat); controller.onClose(); });
      socket.on('error', () => socket?.close());
    },
  });

  return {
    onCommand: (h) => { handler = h; },
    start: () => controller.start(),
  };
};
