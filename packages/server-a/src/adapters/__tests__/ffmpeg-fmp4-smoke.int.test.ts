import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const FMP4_ARGS = [
  '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=15:duration=1',
  '-pix_fmt', 'yuv420p', // Required for baseline profile
  '-an', '-c:v', 'libx264', '-profile:v', 'baseline',
  '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
  'pipe:1',
];

describe('ffmpeg fMP4 smoke', () => {
  it('produces a fragmented MP4 stream with ftyp + moof boxes', async () => {
    if (!ffmpegPath) throw new Error('ffmpeg-static missing');
    const chunks: Buffer[] = [];
    const child = spawn(ffmpegPath, FMP4_ARGS);
    child.stdout.on('data', (c: Buffer) => chunks.push(c));
    await new Promise<void>((resolve) => child.on('close', () => resolve()));

    const out = Buffer.concat(chunks);
    expect(out.length).toBeGreaterThan(0);
    expect(out.includes(Buffer.from('ftyp'))).toBe(true);
    expect(out.includes(Buffer.from('moof'))).toBe(true);
  }, 30000);
});
