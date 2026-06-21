import { spawn, ChildProcess } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { RtspIngestor } from '../ports/rtsp-ingestor';

// Reads the RTSP stream and remuxes it to fragmented MP4 on stdout. The
// fragments are emitted to the fanout; ffmpeg runs continuously regardless of
// the delivery flag (STOP_VIDEO only gates the fanout, not ingest).
export const createFfmpegRtspIngestor = (rtspUrl: string): RtspIngestor => {
  let child: ChildProcess | null = null;
  return {
    start(onFragment) {
      if (!ffmpegPath) throw new Error('ffmpeg-static did not provide a binary path');
      child = spawn(ffmpegPath, [
        '-rtsp_transport', 'tcp',
        '-i', rtspUrl,
        '-an',
        '-c:v', 'copy',
        '-f', 'mp4',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        'pipe:1',
      ]);
      child.stdout?.on('data', (chunk: Buffer) => onFragment(chunk));
    },
    stop() { child?.kill('SIGTERM'); },
  };
};
