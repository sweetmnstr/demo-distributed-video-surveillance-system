import { WebSocketServer, WebSocket } from 'ws';
import { Session } from '@vss/shared';
import { VideoFanout } from '../ports/video-fanout';

export interface VideoFanoutDeps {
  readonly wss: WebSocketServer;
  authorize(token: string): Promise<Session | null>;
  onClientChange(delta: 1 | -1): void;
}

// Authorizes each video WS on its first message (the JWT), then forwards
// fMP4 fragments to every live client while delivery is enabled.
export const createWsVideoFanout = (deps: VideoFanoutDeps): VideoFanout => {
  const clients = new Set<WebSocket>();
  deps.wss.on('connection', (socket) => {
    socket.once('message', async (raw) => {
      try {
        const session = await deps.authorize(String(raw));
        if (!session) { socket.close(1008, 'unauthorized'); return; }
        clients.add(socket);
        deps.onClientChange(1);
        socket.on('close', () => { clients.delete(socket); deps.onClientChange(-1); });
      } catch {
        socket.close(1011, 'internal error');
      }
    });
  });
  return {
    broadcast(fragment) {
      for (const socket of clients) {
        if (socket.readyState === WebSocket.OPEN) socket.send(fragment);
      }
    },
    clientCount: () => clients.size,
  };
};
