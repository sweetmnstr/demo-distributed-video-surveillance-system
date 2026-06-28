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
  // The most recent init segment, replayed to every client that connects later.
  let initSegment: Buffer | null = null;
  deps.wss.on('connection', (socket) => {
    socket.once('message', async (raw) => {
      try {
        const session = await deps.authorize(String(raw));
        if (!session) { socket.close(1008, 'unauthorized'); return; }
        clients.add(socket);
        deps.onClientChange(1);
        // A late joiner missed the one-time init segment on the wire; replay it
        // so MSE can initialize before the next fragment arrives.
        if (initSegment) socket.send(initSegment);
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
    setInitSegment(init) {
      initSegment = init;
      // Clients already connected when the init segment first appears also need it.
      for (const socket of clients) socket.send(init);
    },
    clientCount: () => clients.size,
  };
};
