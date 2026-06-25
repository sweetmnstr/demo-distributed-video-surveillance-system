import { EventEmitter } from 'node:events';

// Build a fake ChildProcess with a readable stdout emitter and a kill spy.
const fakeChild = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only helper; no domain type needed
  const child: any = new EventEmitter();
  child.stdout = new EventEmitter();
  child.kill = jest.fn();
  return child;
};

// spawnMock is declared in module scope so the factory closure below can
// forward calls to it even though the factory is registered before the tests run.
const spawnMock = jest.fn();

// These top-level jest.mock calls are hoisted by babel-jest / ts-jest.
// The module under test uses the mocked modules when it is imported below.
jest.mock('node:child_process', () => ({ spawn: (...a: unknown[]) => spawnMock(...a) }));
jest.mock('ffmpeg-static', () => '/fake/ffmpeg');

// Static import — resolves after the mocks above are in place.
import { createFfmpegRtspIngestor } from '../ffmpeg-rtsp-ingestor';

beforeEach(() => {
  spawnMock.mockReset();
});

describe('ffmpeg-rtsp-ingestor', () => {
  describe('start / stop (happy path)', () => {
    it('spawns ffmpeg with the RTSP URL and pipe:1 flag', () => {
      const child = fakeChild();
      spawnMock.mockReturnValue(child);

      const ing = createFfmpegRtspIngestor('rtsp://x/camera');
      ing.start(() => undefined);

      expect(spawnMock).toHaveBeenCalledTimes(1);
      const [bin, args] = spawnMock.mock.calls[0] as [string, string[]];
      expect(bin).toBe('/fake/ffmpeg');
      expect(args).toContain('rtsp://x/camera');
      expect(args).toContain('pipe:1');
    });

    it('forwards stdout data chunks to the onFragment callback', () => {
      const child = fakeChild();
      spawnMock.mockReturnValue(child);

      const ing = createFfmpegRtspIngestor('rtsp://x/camera');
      const frags: Buffer[] = [];
      ing.start((f) => frags.push(f));

      child.stdout.emit('data', Buffer.from('frag'));

      expect(frags).toHaveLength(1);
      // frags[0] is guaranteed by the length assertion above.
      expect(frags[0]!.toString()).toBe('frag');
    });

    it('stop() sends SIGTERM to the child process', () => {
      const child = fakeChild();
      spawnMock.mockReturnValue(child);

      const ing = createFfmpegRtspIngestor('rtsp://x/camera');
      ing.start(() => undefined);
      ing.stop();

      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('stop() before start() does not throw', () => {
      const ing = createFfmpegRtspIngestor('rtsp://x/camera');
      expect(() => ing.stop()).not.toThrow();
    });
  });

  // The null-ffmpegPath guard is tested in a dedicated file
  // (ffmpeg-rtsp-ingestor-null-path.test.ts) because top-level jest.mock
  // factories cannot be overridden mid-suite via doMock + isolateModules.
});
