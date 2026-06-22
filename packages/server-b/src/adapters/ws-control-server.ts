import { WebSocketServer, WebSocket } from 'ws';
import { ControlClientMessage, ControlServerMessage, Session } from '@vss/shared';
import { authenticateConnection, AuthenticateDeps } from '../use-cases/authenticate-connection';
import { processCommand, ProcessCommandDeps } from '../use-cases/process-command';
import { logout, LogoutDeps } from '../use-cases/logout';

export interface ControlServerDeps {
  readonly wss: WebSocketServer;
  readonly auth: AuthenticateDeps;
  readonly process: ProcessCommandDeps;
  readonly logoutDeps: LogoutDeps;
}

const send = (socket: WebSocket, message: ControlServerMessage): void => socket.send(JSON.stringify(message));

// Client control WS: first message must authenticate; subsequent messages are
// commands routed to processCommand (or logout for LOGOUT).
export const startControlServer = (deps: ControlServerDeps): void => {
  deps.wss.on('connection', (socket) => {
    let session: Session | null = null;
    socket.on('message', async (raw) => {
      try {
        let rawParsed: unknown;
        try {
          rawParsed = JSON.parse(String(raw));
        } catch {
          return send(socket, { type: 'error', text: 'invalid message' });
        }
        const parsed = ControlClientMessage.safeParse(rawParsed);
        if (!parsed.success) return send(socket, { type: 'error', text: 'invalid message' });
        const msg = parsed.data;

        if (msg.type === 'auth') {
          const result = await authenticateConnection(msg.token, deps.auth);
          if (result.kind === 'err') { send(socket, { type: 'error', text: 'unauthorized' }); socket.close(1008); return; }
          session = result.value;
          return send(socket, { type: 'response', ok: true, text: 'authenticated' });
        }
        if (!session) return send(socket, { type: 'error', text: 'not authenticated' });

        if (msg.type === 'command') {
          // LOGOUT is intercepted here before processCommand because it needs to
          // close the socket after revoking the session. canRun() grants LOGOUT
          // to all roles, so bypassing authorizeCommand is safe.
          if (msg.command === 'LOGOUT') {
            const reply = await logout(session, deps.logoutDeps);
            send(socket, { type: 'response', ok: reply.ok, text: reply.text });
            socket.close(1000);
            return;
          }
          const reply = await processCommand(msg.command, session, deps.process);
          return send(socket, { type: 'response', ok: reply.ok, text: reply.text });
        }
        // 'encrypted' messages are handled in plan 07 (Bonus B); reject for now.
        return send(socket, { type: 'error', text: 'encrypted commands not enabled' });
      } catch {
        send(socket, { type: 'error', text: 'internal error' });
        socket.close(1011);
      }
    });
  });
};
