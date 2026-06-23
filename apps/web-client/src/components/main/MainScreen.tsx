import { useEffect, useRef, useState } from 'react';
import { ConsoleLine, outgoing, serverResponse, connectionError, appendLine } from '../../lib/console-log';
import { parseCommand } from '@vss/shared';
import { openControlSocket } from '../../api/control-socket';
import { Console } from '../console/Console';
import { VideoView } from '../video/VideoView';

export const MainScreen = ({ token, onLogout }: { token: string; onLogout: () => void }): JSX.Element => {
  const [lines, setLines] = useState<readonly ConsoleLine[]>([]);
  const add = (line: ConsoleLine): void => setLines((prev) => appendLine(prev, line));
  const socketRef = useRef<{ send(command: import('@vss/shared').Command): void; close(): void } | null>(null);

  useEffect(() => {
    const socket = openControlSocket(token, {
      onResponse: (ok, text) => {
        add(serverResponse(ok, text));
        if (ok && text.toLowerCase().includes('logout')) onLogout();
      },
      onConnectionError: (text) => add(connectionError(text)),
    });
    socketRef.current = socket;
    return () => { socket.close(); socketRef.current = null; };
  }, [token]);

  const handleSubmit = (raw: string): void => {
    const parsed = parseCommand(raw);
    if (parsed.kind === 'err') return add(serverResponse(false, parsed.error));
    add(outgoing(parsed.value));
    socketRef.current?.send(parsed.value);
  };

  return (
    <main aria-labelledby="main-heading">
      <h1 id="main-heading">Live Surveillance</h1>
      <VideoView token={token} />
      <Console lines={lines} onSubmit={handleSubmit} />
    </main>
  );
};
