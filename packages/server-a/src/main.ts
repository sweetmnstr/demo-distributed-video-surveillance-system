import { WebSocketServer } from 'ws';
import { createLogger } from '@vss/shared';
import { createState } from './domain/delivery-state';
import { handleCommand, CommandContext } from './use-cases/handle-command';
import { authorizeViewer } from './use-cases/authorize-viewer';
import { createJoseTokenVerifier } from './adapters/jose-token-verifier';
import { createRedisSessionStore } from './adapters/redis-session-store';
import { createWsVideoFanout } from './adapters/ws-video-fanout';
import { createWsControlClient } from './adapters/ws-control-client';
import { createFfmpegRtspIngestor } from './adapters/ffmpeg-rtsp-ingestor';
import { createFmp4Segmenter } from './domain/fmp4-segmenter';

const env = (key: string, fallback: string): string => process.env[key] ?? fallback;
const log = createLogger('server-a');

const main = async (): Promise<void> => {
  const verifier = await createJoseTokenVerifier(env('PUBLIC_KEY_PATH', 'config/keys/public.pem'));
  const sessions = createRedisSessionStore(env('REDIS_URL', 'redis://127.0.0.1:6379'));

  let state = createState(Date.now());
  const ctx: CommandContext = { getState: () => state, setState: (s) => { state = s; }, now: () => Date.now() };

  const videoWsPort = Number(env('VIDEO_WS_PORT', '2222'));
  const rtspUrl = env('RTSP_URL', 'rtsp://127.0.0.1:1111/camera');
  const controlWsUrl = env('CONTROL_WS_URL', 'ws://127.0.0.1:3001/control-a');
  log.info(`starting: video WS on :${videoWsPort}, RTSP listen ${rtspUrl}, control ${controlWsUrl}`);

  const wss = new WebSocketServer({ port: videoWsPort });
  const fanout = createWsVideoFanout({
    wss,
    authorize: async (token) => {
      const r = await authorizeViewer(token, { verifier, sessions });
      if (r.kind !== 'ok') { log.warn('rejected an unauthorized video viewer'); return null; }
      return r.value;
    },
    onClientChange: (delta) => {
      state = { ...state, clients: Math.max(0, state.clients + delta) };
      log.info(`viewer ${delta > 0 ? 'connected' : 'disconnected'} (${state.clients} watching)`);
    },
  });

  // ffmpeg emits arbitrary byte chunks; the segmenter splits them into the one-time
  // init segment (cached + replayed to new viewers) and whole keyframe fragments.
  const segmenter = createFmp4Segmenter();
  const ingest = createFfmpegRtspIngestor(rtspUrl);
  ingest.start((chunk) => {
    const { init, fragments } = segmenter.push(chunk);
    if (init) {
      fanout.setInitSegment(init);
      log.info(`captured fMP4 init segment (${init.length} bytes); stream is live`);
    }
    if (!state.delivering) return;
    for (const fragment of fragments) fanout.broadcast(fragment);
  });

  const control = createWsControlClient({
    serverBUrl: controlWsUrl,
    backoff: { baseMs: 1000, capMs: 30000 },
    heartbeatMs: 15000,
  });
  control.onCommand(async (command) => {
    const reply = handleCommand(command, ctx);
    log.info(`command ${command} -> ${reply.ok ? 'OK' : 'ERR'}: ${reply.text}`);
    return reply;
  });
  control.start();
  log.info('control client connecting to Server B');
};

main().catch((err: unknown) => {
  console.error('Fatal startup error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
