import { useEffect, useRef, useState } from 'react';
import { ConsoleLine, outgoing, serverResponse, connectionError, appendLine } from '../../lib/console-log';
import { parseCommand, JwtClaims, Role } from '@vss/shared';
import { openControlSocket } from '../../api/control-socket';
import { createEncryptor } from '../../api/encrypt';
import { Console } from '../console/Console';
import { VideoView } from '../video/VideoView';
import { NavBar } from '../nav/NavBar';

const decodeRole = (token: string): Role => {
  try {
    const payload = JSON.parse(atob((token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))) as JwtClaims;
    return payload.role;
  } catch {
    return 'viewer';
  }
};

export const MainScreen = ({ token, onLogout }: { token: string; onLogout: () => void }): JSX.Element => {
  const [lines, setLines] = useState<readonly ConsoleLine[]>([]);
  const [videoRunning, setVideoRunning] = useState(true);
  const add = (line: ConsoleLine): void => setLines((prev) => appendLine(prev, line));
  const socketRef = useRef<{ send(command: import('@vss/shared').Command): void; sendEncrypted(payloadBase64: string): void; close(): void } | null>(null);
  const encryptRef = useRef<((plaintext: string) => Promise<string>) | null>(null);

  useEffect(() => {
    const socket = openControlSocket(token, {
      onResponse: (ok, text) => add(serverResponse(ok, text)),
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

    if (parsed.value === 'LOGOUT') return handleLogout();

    if (parsed.value === 'START_VIDEO') setVideoRunning(true);
    else if (parsed.value === 'STOP_VIDEO') setVideoRunning(false);

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

  const handleLogout = (): void => {
    // One teardown path for both the navbar button and the console LOGOUT command:
    // stop video locally, revoke server-side, close the socket, force re-auth.
    setVideoRunning(false);
    socketRef.current?.send('LOGOUT');
    socketRef.current?.close();
    onLogout();
  };

  return (
    <div className="app">
      <NavBar links={[{ label: 'Docs', to: '/docs' }]} onLogout={handleLogout} />
      <main className="app-main main-screen" aria-labelledby="main-heading">
        <h1 id="main-heading" className="main-screen__title">Live Surveillance</h1>
        <div className="main-grid">
          <section className="stage card" aria-label="Video stage">
            <div className="stage__bar"><span className="stage__dot" /> Live camera</div>
            {videoRunning
              ? <VideoView token={token} />
              : <div className="stage__stopped">Video stopped</div>}
          </section>
          <Console lines={lines} role={decodeRole(token)} onSubmit={handleSubmit} />
        </div>
      </main>
    </div>
  );
};
