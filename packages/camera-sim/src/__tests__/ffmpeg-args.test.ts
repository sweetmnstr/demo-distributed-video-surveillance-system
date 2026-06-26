import { buildFfmpegArgs } from '../ffmpeg-args';

describe('buildFfmpegArgs', () => {
  const args = buildFfmpegArgs('/media/clip.mp4', 'rtsp://127.0.0.1:1111/camera');

  it('loops the source file in real time as the input', () => {
    const beforeInput = args.slice(0, args.indexOf('-i'));
    expect(beforeInput).toEqual(expect.arrayContaining(['-stream_loop', '-1', '-re']));
    expect(args[args.indexOf('-i') + 1]).toBe('/media/clip.mp4');
  });

  it('re-encodes to baseline H.264 without audio and outputs RTSP', () => {
    expect(args).toEqual(expect.arrayContaining(['-an', '-c:v', 'libx264', '-profile:v', 'baseline']));
    expect(args[args.indexOf('-vf') + 1]).toBe('format=yuv420p');
    expect(args[args.indexOf('-f', args.indexOf('-c:v')) + 1]).toBe('rtsp');
    expect(args[args.length - 1]).toBe('rtsp://127.0.0.1:1111/camera');
  });

  // The camera is the RTSP client (it pushes); Server A owns the listening socket.
  it('stays an RTSP client and never tries to listen', () => {
    expect(args).not.toContain('-rtsp_flags');
    expect(args).not.toContain('listen');
  });
});
