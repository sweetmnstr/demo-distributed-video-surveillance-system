import { useEffect, useRef, useState } from 'react';
import { ConsoleLine, outgoing, serverResponse, connectionError, appendLine } from '../../lib/console-log';
import { parseCommand } from '@vss/shared';
import { openControlSocket } from '../../api/control-socket';
import { createEncryptor } from '../../api/encrypt';
import { Console } from '../console/Console';
import { VideoView } from '../video/VideoView';

export const MainScreen = ({ token, onLogout }: { token: string; onLogout: () => void }): JSX.Element => {
  const [lines, setLines] = useState<readonly ConsoleLine[]>([]);
  const add = (line: ConsoleLine): void => setLines((prev) => appendLine(prev, line));
  const socketRef = useRef<{ send(command: import('@vss/shared').Command): void; sendEncrypted(payloadBase64: string): void; close(): void } | null>(null);
  const encryptRef = useRef<((plaintext: string) => Promise<string>) | null>(null);

  useEffect(() => {
    const socket = openControlSocket(token, {
      onResponse: (ok, text) => {
        add(serverResponse(ok, text));
        if (ok && text.toLowerCase().includes('logout')) onLogout();
      },
      onConnectionError: (text) => add(connectionError(text)),
    });
    socketRef.current = socket;

    // Attempt to set up RSA-OAEP encryptor; silently fall back to plaintext if unavailable.
    createEncryptor()
      .then((encrypt) => { encryptRef.current = encrypt; })
      .catch(() => { encryptRef.current = null; });

    return () => { socket.close(); socketRef.current = null; };
  }, [token]);

  const handleSubmit = (raw: string): void => {
    const parsed = parseCommand(raw);
    if (parsed.kind === 'err') return add(serverResponse(false, parsed.error));
    add(outgoing(parsed.value));

    const socket = socketRef.current;
    const encrypt = encryptRef.current;

    if (encrypt !== null && socket !== null) {
      // Encrypted path: encrypt the command string then send as base64 ciphertext.
      encrypt(String(parsed.value))
        .then((cipher) => { socket.sendEncrypted(cipher); })
        .catch(() => { socket.send(parsed.value); });
    } else {
      // Plaintext fallback when no encryptor is available.
      socket?.send(parsed.value);
    }
  };

  return (
    <main aria-labelledby="main-heading">
      <h1 id="main-heading">Live Surveillance</h1>
      <VideoView token={token} />
      <Console lines={lines} onSubmit={handleSubmit} />
    </main>
  );
};
