import { buildFfmpegArgs } from '../ffmpeg-args';

describe('buildFfmpegArgs', () => {
  const FONT = '/fonts/DejaVuSans.ttf';
  const args = buildFfmpegArgs('/media/clip.mp4', 'rtsp://127.0.0.1:1111/camera', FONT);
  const vf = args[args.indexOf('-vf') + 1];

  it('loops the source file in real time as the input', () => {
    const beforeInput = args.slice(0, args.indexOf('-i'));
    expect(beforeInput).toEqual(expect.arrayContaining(['-stream_loop', '-1', '-re']));
    expect(args[args.indexOf('-i') + 1]).toBe('/media/clip.mp4');
  });

  it('re-encodes to baseline H.264 without audio and outputs RTSP', () => {
    expect(args).toEqual(expect.arrayContaining(['-an', '-c:v', 'libx264', '-profile:v', 'baseline']));
    expect(args[args.indexOf('-f', args.indexOf('-c:v')) + 1]).toBe('rtsp');
    expect(args[args.length - 1]).toBe('rtsp://127.0.0.1:1111/camera');
  });

  it('starts the video filter chain with the pixel-format conversion', () => {
    expect(vf.startsWith('format=yuv420p,')).toBe(true);
  });

  it('overlays a drawtext timer using the provided font', () => {
    expect(vf).toContain('drawtext=');
    expect(vf).toContain('/fonts/DejaVuSans.ttf');
    // Wall-clock line (localtime) for freshness/latency.
    expect(vf).toContain('localtime');
    // Elapsed seconds line.
    expect(vf).toContain('%{pts');
  });

  it('stays an RTSP client and never tries to listen', () => {
    expect(args).not.toContain('-rtsp_flags');
    expect(args).not.toContain('listen');
  });

  it('escapes a Windows absolute font path for the filtergraph', () => {
    const winArgs = buildFfmpegArgs('/m/clip.mp4', 'rtsp://x', 'C:\\Windows\\Fonts\\arial.ttf');
    const winVf = winArgs[winArgs.indexOf('-vf') + 1];
    // Backslashes -> forward slashes, drive-letter colon escaped as '\:'.
    expect(winVf).toContain('fontfile=C\\:/Windows/Fonts/arial.ttf');
  });
});
