import { buildFfmpegArgs } from '../ffmpeg-args';

describe('buildFfmpegArgs', () => {
  const args = buildFfmpegArgs('rtsp://127.0.0.1:1111/camera');

  it('loops a synthetic source in real time', () => {
    expect(args).toEqual(expect.arrayContaining(['-re', '-stream_loop', '-1', '-f', 'lavfi']));
  });

  it('renders a live seconds counter via drawtext', () => {
    const vf = args[args.indexOf('-vf') + 1];
    expect(vf).toContain('drawtext');
    expect(vf).toContain('%{pts');
  });

  it('encodes baseline H.264 with no B-frames and outputs RTSP', () => {
    expect(args).toEqual(expect.arrayContaining(['-c:v', 'libx264', '-profile:v', 'baseline']));
    expect(args[args.indexOf('-f', args.indexOf('-c:v')) + 1]).toBe('rtsp');
    expect(args[args.length - 1]).toBe('rtsp://127.0.0.1:1111/camera');
  });
});
