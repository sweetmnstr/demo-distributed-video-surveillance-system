import { WebSocketServer, WebSocket } from 'ws';
import { ControlClientMessage, ControlServerMessage, Session, CommandCipher, Command, createLogger } from '@vss/shared';
import { authenticateConnection, AuthenticateDeps } from '../use-cases/authenticate-connection';
import { processCommand, ProcessCommandDeps } from '../use-cases/process-command';
import { logout, LogoutDeps } from '../use-cases/logout';
import { decryptCommand } from '../use-cases/decrypt-command';

const log = createLogger('server-b');

export interface ControlServerDeps {
  readonly wss: WebSocketServer;
  readonly auth: AuthenticateDeps;
  readonly process: ProcessCommandDeps;
  readonly logoutDeps: LogoutDeps;
  readonly cipher: CommandCipher;
}

const send = (socket: WebSocket, message: ControlServerMessage): void => socket.send(JSON.stringify(message));

const routeCommand = async (command: Command, session: Session, socket: WebSocket, deps: ControlServerDeps): Promise<void> => {
  if (command === 'LOGOUT') {
    const reply = await logout(session, deps.logoutDeps);
    log.info(`LOGOUT by ${session.login} (ok=${reply.ok})`);
    send(socket, { type: 'response', ok: reply.ok, text: reply.text });
    socket.close(1000);
    return;
  }
  const reply = await processCommand(command, session, deps.process);
  log.info(`command ${command} by ${session.login} (${session.role}) ok=${reply.ok}: ${reply.text}`);
  send(socket, { type: 'response', ok: reply.ok, text: reply.text });
};

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
          if (result.kind === 'err') {
            log.warn('control client auth rejected');
            await deps.process.audit.append('unknown', 'AUTH rejected');
            send(socket, { type: 'error', text: 'unauthorized' });
            socket.close(1008);
            return;
          }
          session = result.value;
          log.info(`control client authenticated: ${session.login} (${session.role})`);
          await deps.process.audit.append(session.login, `AUTH ${session.login} accepted`);
          return send(socket, { type: 'response', ok: true, text: 'authenticated' });
        }
        if (!session) return send(socket, { type: 'error', text: 'not authenticated' });

        if (msg.type === 'command') {
          // LOGOUT is intercepted inside routeCommand because it needs to
          // close the socket after revoking the session. canRun() grants LOGOUT
          // to all roles, so bypassing authorizeCommand is safe.
          return routeCommand(msg.command, session, socket, deps);
        }
        if (msg.type === 'encrypted') {
          const decrypted = await decryptCommand(msg.payload, deps.cipher);
          if (decrypted.kind === 'err') return send(socket, { type: 'error', text: decrypted.error });
          return routeCommand(decrypted.value, session, socket, deps);
        }
        /* istanbul ignore next -- TypeScript exhaustiveness guard; unreachable at runtime by design */
        void ((_exhaustive: never) => _exhaustive)(msg);
      } catch {
        send(socket, { type: 'error', text: 'internal error' });
        socket.close(1011);
      }
    });
  });
};
