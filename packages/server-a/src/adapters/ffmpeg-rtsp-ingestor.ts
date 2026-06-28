import { spawn, ChildProcess } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { RtspIngestor } from '../ports/rtsp-ingestor';

const RECONNECT_DELAY_MS = 2_000;

const FFMPEG_ARGS = (rtspUrl: string): string[] => [
  '-rtsp_transport', 'tcp',
  // Server A owns the RTSP listening socket; the camera connects and pushes.
  // ffmpeg's RTSP demuxer reliably accepts an incoming connection in listen
  // mode, whereas the muxer (camera side) does not bind a socket reliably.
  '-rtsp_flags', 'listen',
  '-i', rtspUrl,
  '-an',
  '-c:v', 'copy',
  '-f', 'mp4',
  '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
  'pipe:1',
];

// Reads the RTSP stream and remuxes it to fragmented MP4 on stdout.
// Auto-reconnects when the source restarts (e.g. camera-sim supervisor cycle).
// STOP_VIDEO only gates the fanout — ingest keeps running regardless.
export const createFfmpegRtspIngestor = (rtspUrl: string): RtspIngestor => {
  if (!ffmpegPath) throw new Error('ffmpeg-static did not provide a binary path');

  let child: ChildProcess | null = null;
  let stopped = false;
  let onFragmentCb: ((buf: Buffer) => void) | null = null;

  const spawnChild = (): void => {
    if (stopped) return;
    child = spawn(ffmpegPath as string, FFMPEG_ARGS(rtspUrl));
    child.stdout?.on('data', (chunk: Buffer) => { onFragmentCb?.(chunk); });
    child.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(`[ffmpeg-ingest] ${chunk.toString()}`);
    });
    child.on('exit', (code) => {
      if (!stopped) {
        process.stderr.write(`[ffmpeg-ingest] exited (${code ?? 'signal'}), reconnecting in ${RECONNECT_DELAY_MS}ms\n`);
        setTimeout(spawnChild, RECONNECT_DELAY_MS);
      }
    });
  };

  return {
    start(onFragment) {
      onFragmentCb = onFragment;
      spawnChild();
    },
    stop() {
      stopped = true;
      child?.kill('SIGTERM');
    },
  };
};
