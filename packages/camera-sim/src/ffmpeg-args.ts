// Builds ffmpeg CLI args for a looping synthetic RTSP source with a live
// seconds counter overlay. The counter lets clients gauge stream freshness.
const COUNTER_FILTER =
  "format=yuv420p," +
  "drawtext=text='%{pts\\:hms}':x=20:y=20:fontsize=36:fontcolor=white:box=1:boxcolor=black@0.5";

export const buildFfmpegArgs = (rtspUrl: string): string[] => [
  '-re',
  '-stream_loop', '-1',
  '-f', 'lavfi',
  '-i', 'testsrc=size=640x480:rate=30',
  '-vf', COUNTER_FILTER,
  '-c:v', 'libx264',
  '-profile:v', 'baseline',
  '-x264-params', 'bframes=0',
  '-an',
  '-f', 'rtsp',
  rtspUrl,
];
