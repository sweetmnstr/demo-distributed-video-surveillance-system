import ffmpegPath from 'ffmpeg-static';
import { createLogger } from '@vss/shared';
import { buildFfmpegArgs } from './ffmpeg-args';
import { startSupervisor } from './supervisor';
import { createRealRunner } from './real-runner';

const RTSP_URL = process.env.RTSP_URL ?? 'rtsp://127.0.0.1:1111/camera';
const log = createLogger('camera-sim');

const main = (): void => {
  if (!ffmpegPath) throw new Error('ffmpeg-static did not provide a binary path');
  log.info(`pushing synthetic RTSP stream to ${RTSP_URL}`);
  const stop = startSupervisor(
    createRealRunner(),
    ffmpegPath,
    buildFfmpegArgs(RTSP_URL),
    { baseMs: 1000, capMs: 30000 },
    log,
  );
  process.on('SIGINT', () => { stop(); process.exit(0); });
  process.on('SIGTERM', () => { stop(); process.exit(0); });
};

main();
