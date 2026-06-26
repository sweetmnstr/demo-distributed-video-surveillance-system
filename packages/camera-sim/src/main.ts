import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { createLogger } from '@vss/shared';
import { buildFfmpegArgs } from './ffmpeg-args';
import { startSupervisor } from './supervisor';
import { createRealRunner } from './real-runner';

const RTSP_URL = process.env.RTSP_URL ?? 'rtsp://127.0.0.1:1111/camera';
// Defaults to the repository's bundled clip, resolved from dist/ up to the repo
// root (packages/camera-sim/dist -> repo root is three levels up). Override with CAMERA_SOURCE.
const SOURCE = process.env.CAMERA_SOURCE ?? resolve(__dirname, '../../../test.mp4');
const log = createLogger('camera-sim');

const main = (): void => {
  if (!ffmpegPath) throw new Error('ffmpeg-static did not provide a binary path');
  if (!existsSync(SOURCE)) throw new Error(`camera source file not found: ${SOURCE}`);
  log.info(`looping ${SOURCE} -> ${RTSP_URL}`);
  const stop = startSupervisor(
    createRealRunner(),
    ffmpegPath,
    buildFfmpegArgs(SOURCE, RTSP_URL),
    { baseMs: 1000, capMs: 30000 },
    log,
  );
  process.on('SIGINT', () => { stop(); process.exit(0); });
  process.on('SIGTERM', () => { stop(); process.exit(0); });
};

main();
