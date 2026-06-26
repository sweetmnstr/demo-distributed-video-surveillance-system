import { buildFfmpegArgs } from '../ffmpeg-args';

describe('buildFfmpegArgs', () => {
  const args = buildFfmpegArgs('rtsp://127.0.0.1:1111/camera');

  it('loops a synthetic source in real time', () => {
    expect(args).toEqual(expect.arrayContaining(['-re', '-stream_loop', '-1', '-f', 'lavfi']));
  });

  it('normalizes pixels to yuv420p so libx264 accepts the testsrc frames', () => {
    const vf = args[args.indexOf('-vf') + 1];
    expect(vf).toBe('format=yuv420p');
  });

  it('encodes baseline H.264 with no B-frames and outputs RTSP', () => {
    expect(args).toEqual(expect.arrayContaining(['-c:v', 'libx264', '-profile:v', 'baseline']));
    expect(args[args.indexOf('-f', args.indexOf('-c:v')) + 1]).toBe('rtsp');
    expect(args[args.length - 1]).toBe('rtsp://127.0.0.1:1111/camera');
  });

  // The camera is the RTSP *client*: it pushes (ANNOUNCE/RECORD) to the server.
  // ffmpeg's RTSP muxer does not reliably open a listening socket in "listen"
  // mode, so the listener role belongs to Server A's ingestor, not the camera.
  it('pushes as an RTSP client and never tries to listen', () => {
    expect(args).not.toContain('-rtsp_flags');
    expect(args).not.toContain('listen');
  });
});
