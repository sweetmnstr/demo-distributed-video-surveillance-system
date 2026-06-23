import { ControlServerMessage, Command } from '@vss/shared';
import { authMessage, commandMessage } from '../lib/messages';

const WS_URL = import.meta.env.VITE_SERVER_B_WS ?? 'ws://127.0.0.1:3000';

export interface ControlSocketHandlers {
  onResponse(ok: boolean, text: string): void;
  onConnectionError(text: string): void;
}

// Opens the control WS, authenticates, and exposes a send(command) function.
export const openControlSocket = (
  token: string,
  handlers: ControlSocketHandlers,
): { send(command: Command): void; sendEncrypted(payloadBase64: string): void; close(): void } => {
  const socket = new WebSocket(WS_URL);
  socket.addEventListener('open', () => socket.send(JSON.stringify(authMessage(token))));
  socket.addEventListener('message', (event) => {
    const parsed = ControlServerMessage.safeParse(JSON.parse(String(event.data)));
    if (!parsed.success) return handlers.onConnectionError('malformed server message');
    if (parsed.data.type === 'response') handlers.onResponse(parsed.data.ok, parsed.data.text);
    else handlers.onConnectionError(parsed.data.text);
  });
  socket.addEventListener('close', () => handlers.onConnectionError('control connection closed'));
  socket.addEventListener('error', () => handlers.onConnectionError('control connection error'));
  return {
    send: (command) => socket.send(JSON.stringify(commandMessage(command))),
    sendEncrypted: (payloadBase64) => socket.send(JSON.stringify({ type: 'encrypted', payload: payloadBase64 })),
    close: () => socket.close(),
  };
};
