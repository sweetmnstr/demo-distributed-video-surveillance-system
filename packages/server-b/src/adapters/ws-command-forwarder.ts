import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { Command, InterServerCommand, InterServerResult } from '@vss/shared';
import { CommandForwarder } from '../ports/command-forwarder';
import { CommandReply } from '../reply';

const REQUEST_TIMEOUT_MS = 5000;

export interface ForwarderDeps {
  readonly wss: WebSocketServer;
}

// A↔B WebSocket server. Server A connects here; B sends an exec message and
// awaits the matching result. If no Server A is connected (link down), the
// command is rejected immediately — never queued (spec §8.5).
export const createWsCommandForwarder = (deps: ForwarderDeps): CommandForwarder => {
  let serverA: WebSocket | null = null;
  const pending = new Map<string, (reply: CommandReply) => void>();

  deps.wss.on('connection', (socket) => {
    serverA = socket;
    socket.on('message', (raw) => {
      let rawParsed: unknown;
      try {
        rawParsed = JSON.parse(String(raw));
      } catch {
        return;
      }
      const parsed = InterServerResult.safeParse(rawParsed);
      if (!parsed.success) return;
      const resolve = pending.get(parsed.data.requestId);
      if (resolve) { pending.delete(parsed.data.requestId); resolve({ ok: parsed.data.ok, text: parsed.data.text }); }
    });
    socket.on('close', () => { if (serverA === socket) serverA = null; });
  });

  return {
    forward(command: Command): Promise<CommandReply> {
      if (!serverA || serverA.readyState !== WebSocket.OPEN) {
        return Promise.resolve({ ok: false, text: 'video server unavailable (A↔B link down)' });
      }
      const requestId = randomUUID();
      const message: InterServerCommand = { type: 'exec', requestId, command };
      const socket = serverA;
      return new Promise<CommandReply>((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          resolve({ ok: false, text: 'video server timed out' });
        }, REQUEST_TIMEOUT_MS);
        pending.set(requestId, (reply) => { clearTimeout(timer); resolve(reply); });
        socket.send(JSON.stringify(message));
      });
    },
  };
};
