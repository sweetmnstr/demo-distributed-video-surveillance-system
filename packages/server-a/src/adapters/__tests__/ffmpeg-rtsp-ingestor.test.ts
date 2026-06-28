import { EventEmitter } from 'node:events';

// Build a fake ChildProcess with a readable stdout emitter and a kill spy.
const fakeChild = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only helper; no domain type needed
  const child: any = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
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

    // Server A owns the RTSP listening socket: the camera connects to it and
    // pushes. ffmpeg's RTSP *demuxer* reliably accepts an incoming connection
    // in listen mode, unlike the muxer — this is the working topology.
    it('listens for the camera push via -rtsp_flags listen on the input', () => {
      const child = fakeChild();
      spawnMock.mockReturnValue(child);

      createFfmpegRtspIngestor('rtsp://x/camera').start(() => undefined);

      const [, args] = spawnMock.mock.calls[0] as [string, string[]];
      expect(args.slice(0, args.indexOf('-i'))).toEqual(
        expect.arrayContaining(['-rtsp_flags', 'listen']),
      );
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

  describe('resilience (stderr + reconnect)', () => {
    let writeSpy: jest.SpiedFunction<typeof process.stderr.write>;

    beforeEach(() => {
      writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      writeSpy.mockRestore();
      jest.useRealTimers();
    });

    it('forwards ffmpeg stderr output with a prefix', () => {
      const child = fakeChild();
      spawnMock.mockReturnValue(child);

      createFfmpegRtspIngestor('rtsp://x/camera').start(() => undefined);
      child.stderr.emit('data', Buffer.from('connection failed'));

      expect(writeSpy).toHaveBeenCalledWith('[ffmpeg-ingest] connection failed');
    });

    it('respawns ffmpeg after an unexpected exit', () => {
      jest.useFakeTimers();
      const child = fakeChild();
      spawnMock.mockReturnValue(child);

      createFfmpegRtspIngestor('rtsp://x/camera').start(() => undefined);
      expect(spawnMock).toHaveBeenCalledTimes(1);

      child.emit('exit', 1);
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('exited (1)'));

      jest.advanceTimersByTime(2_000);
      expect(spawnMock).toHaveBeenCalledTimes(2);
    });

    it('labels a signal-terminated exit when the code is null', () => {
      jest.useFakeTimers();
      const child = fakeChild();
      spawnMock.mockReturnValue(child);

      createFfmpegRtspIngestor('rtsp://x/camera').start(() => undefined);
      child.emit('exit', null);

      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('exited (signal)'));
    });

    it('aborts a pending reconnect when stop() is called before the timer fires', () => {
      jest.useFakeTimers();
      const child = fakeChild();
      spawnMock.mockReturnValue(child);

      const ing = createFfmpegRtspIngestor('rtsp://x/camera');
      ing.start(() => undefined);
      child.emit('exit', 1); // schedules a reconnect
      ing.stop(); // ...which must be cancelled by stop()

      jest.advanceTimersByTime(2_000);
      expect(spawnMock).toHaveBeenCalledTimes(1);
    });

    it('does not respawn after stop()', () => {
      jest.useFakeTimers();
      const child = fakeChild();
      spawnMock.mockReturnValue(child);

      const ing = createFfmpegRtspIngestor('rtsp://x/camera');
      ing.start(() => undefined);
      ing.stop();
      child.emit('exit', null);

      jest.advanceTimersByTime(2_000);
      expect(spawnMock).toHaveBeenCalledTimes(1);
    });
  });

  // The null-ffmpegPath guard is tested in a dedicated file
  // (ffmpeg-rtsp-ingestor-null-path.test.ts) because top-level jest.mock
  // factories cannot be overridden mid-suite via doMock + isolateModules.
});
