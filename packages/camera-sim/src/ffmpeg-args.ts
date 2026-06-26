// format=yuv420p is required because libx264 does not accept rgb24 from testsrc.
// drawtext is dropped: fontconfig is unavailable in the bundled ffmpeg on Windows
// and causes the filter chain to abort. The moving pattern from testsrc is
// sufficient to verify stream freshness visually.
const VIDEO_FILTER = 'format=yuv420p';

export const buildFfmpegArgs = (rtspUrl: string): string[] => [
  '-re',
  '-stream_loop', '-1',
  '-f', 'lavfi',
  '-i', 'testsrc=size=640x480:rate=30',
  '-vf', VIDEO_FILTER,
  '-c:v', 'libx264',
  '-profile:v', 'baseline',
  '-x264-params', 'bframes=0',
  '-an',
  '-f', 'rtsp',
  rtspUrl,
];
