import { WebSocketServer } from 'ws';
import { createState } from './domain/delivery-state';
import { handleCommand, CommandContext } from './use-cases/handle-command';
import { authorizeViewer } from './use-cases/authorize-viewer';
import { createJoseTokenVerifier } from './adapters/jose-token-verifier';
import { createRedisSessionStore } from './adapters/redis-session-store';
import { createWsVideoFanout } from './adapters/ws-video-fanout';
import { createWsControlClient } from './adapters/ws-control-client';
import { createFfmpegRtspIngestor } from './adapters/ffmpeg-rtsp-ingestor';

const env = (key: string, fallback: string): string => process.env[key] ?? fallback;

const main = (): void => {
  const verifier = createJoseTokenVerifier(env('PUBLIC_KEY_PATH', 'config/keys/public.pem'));
  const sessions = createRedisSessionStore(env('REDIS_URL', 'redis://127.0.0.1:6379'));

  let state = createState(Date.now());
  const ctx: CommandContext = { getState: () => state, setState: (s) => { state = s; }, now: () => Date.now() };

  const wss = new WebSocketServer({ port: Number(env('VIDEO_WS_PORT', '2222')) });
  const fanout = createWsVideoFanout({
    wss,
    authorize: async (token) => {
      const r = await authorizeViewer(token, { verifier, sessions });
      return r.kind === 'ok' ? r.value : null;
    },
    onClientChange: (delta) => {
      state = { ...state, clients: Math.max(0, state.clients + delta) };
    },
  });

  const ingest = createFfmpegRtspIngestor(env('RTSP_URL', 'rtsp://127.0.0.1:1111/camera'));
  ingest.start((fragment) => { if (state.delivering) fanout.broadcast(fragment); });

  const control = createWsControlClient({
    serverBUrl: env('CONTROL_WS_URL', 'ws://127.0.0.1:3001/control-a'),
    backoff: { baseMs: 1000, capMs: 30000 },
    heartbeatMs: 15000,
  });
  control.onCommand(async (command) => handleCommand(command, ctx));
  control.start();
};

main();
