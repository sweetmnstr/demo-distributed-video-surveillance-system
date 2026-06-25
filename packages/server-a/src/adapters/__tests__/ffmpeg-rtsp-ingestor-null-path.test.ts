// This file tests only the null ffmpegPath guard in ffmpeg-rtsp-ingestor.
// It lives in a separate file so that jest.mock('ffmpeg-static') can return
// null without conflicting with the top-level mock in the happy-path suite.

jest.mock('ffmpeg-static', () => null);
jest.mock('node:child_process', () => ({ spawn: jest.fn() }));

import { createFfmpegRtspIngestor } from '../ffmpeg-rtsp-ingestor';

describe('ffmpeg-rtsp-ingestor — null ffmpegPath', () => {
  it('throws a meaningful error when ffmpeg-static returns null', () => {
    const ing = createFfmpegRtspIngestor('rtsp://x/camera');
    expect(() => ing.start(() => undefined)).toThrow(
      'ffmpeg-static did not provide a binary path',
    );
  });
});
