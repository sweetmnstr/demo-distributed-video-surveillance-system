// format=yuv420p is required because libx264 does not accept some pixel formats.
const VIDEO_FILTER = 'format=yuv420p';

// Loops a real video file as the synthetic camera feed and re-encodes it to
// baseline H.264 so the browser's MSE SourceBuffer (avc1.42C01F, Level 3.1 for
// the bundled 1280x720 clip) can decode it.
// The camera is the RTSP client and pushes to Server A (which owns the listener).
export const buildFfmpegArgs = (source: string, rtspUrl: string): string[] => [
  '-stream_loop', '-1',
  '-re',
  '-i', source,
  '-an',
  '-vf', VIDEO_FILTER,
  '-c:v', 'libx264',
  '-profile:v', 'baseline',
  '-x264-params', 'bframes=0',
  '-f', 'rtsp',
  rtspUrl,
];
