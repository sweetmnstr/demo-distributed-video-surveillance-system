// Builds the video filter chain: pixel-format conversion required by libx264,
// followed by a drawtext overlay that renders a live wall-clock time and an
// elapsed timer (H:M:S.mmm). The wall-clock line is the authoritative
// freshness/latency indicator since it never resets across loop boundaries or
// ffmpeg restarts.
//
// Escaping notes (Windows ffmpeg 6.x, args passed via Node execFileSync):
//   • Single quotes around text values prevent the ffmpeg filter-option parser
//     from treating ':' as an option separator. This is required for text
//     expressions that contain colons (e.g. pts:hms).
//   • %{localtime} is used WITHOUT a format string. Providing a strftime format
//     via '\:FORMAT' renders blank text on this Windows ffmpeg build — either
//     because the text-expansion engine does not recognise '\:' as the
//     function-argument separator when args are passed via Node execFileSync, or
//     because Windows MSVC strftime does not support POSIX specifiers (e.g. %T).
//     The default output of %{localtime} on this build is already the ISO-style
//     'YYYY-MM-DD HH:MM:SS', which is exactly what the overlay needs.
//   • Template-literal rule: '\\:' → '\:' in the JS string → '\:' passed to
//     ffmpeg → recognised by the text-expansion engine as the pts:hms separator.
const buildVideoFilter = (fontPath: string): string => {
  // fontPath is an internally-resolved path (from resolveFontPath / CAMERA_FONT),
  // never raw user input. Escape it for the ffmpeg filtergraph: backslashes
  // become forward slashes and the drive-letter colon is escaped as '\:' so the
  // filter-option parser does not treat it as an option separator. E.g.
  // 'C:\Users\x\font.ttf' -> 'C:/Users/x/font.ttf' -> 'C\:/Users/x/font.ttf'.
  const escapedFont = fontPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  const common = [
    `fontfile=${escapedFont}`,
    'fontcolor=white',
    'fontsize=28',
    'box=1',
    'boxcolor=black@0.5',
    'boxborderw=8',
    'x=20',
  ].join(':');
  // Two stacked drawtext filters: wall-clock (top) and elapsed timer (below).
  // %{localtime} uses the default ISO-style wall-clock (no format arg needed).
  // %{pts\:hms} renders the elapsed stream time as H:M:S.mmm; '\:' is the
  // text-expansion separator for the hms format.
  const clock = `drawtext=${common}:y=20:text='%{localtime}'`;
  const elapsed = `drawtext=${common}:y=60:text='elapsed %{pts\\:hms}'`;
  return `format=yuv420p,${clock},${elapsed}`;
};

// Loops a real video file as the synthetic camera feed and re-encodes it to
// baseline H.264 so the browser's MSE SourceBuffer (avc1.42C01F) can decode it.
// The camera is the RTSP client and pushes to Server A (which owns the listener).
export const buildFfmpegArgs = (source: string, rtspUrl: string, fontPath: string): string[] => [
  '-stream_loop', '-1',
  '-re',
  '-i', source,
  '-an',
  '-vf', buildVideoFilter(fontPath),
  '-c:v', 'libx264',
  '-profile:v', 'baseline',
  '-x264-params', 'bframes=0',
  '-f', 'rtsp',
  rtspUrl,
];
