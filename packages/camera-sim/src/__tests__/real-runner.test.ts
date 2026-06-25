// Tests for real-runner.ts — verifies that createRealRunner wraps node:child_process
// spawn correctly: spawning with the right args, forwarding exit events, and killing
// the child process on demand.

import { EventEmitter } from 'node:events';

// Declare spawnMock at module scope so the factory closure can reference it.
const spawnMock = jest.fn();

jest.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

import { createRealRunner } from '../real-runner';

// Build a minimal fake ChildProcess that emits 'exit' on demand.
const fakeChild = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only fake, no domain type needed
  const child: any = new EventEmitter();
  child.kill = jest.fn();
  return child;
};

beforeEach(() => {
  spawnMock.mockReset();
});

describe('createRealRunner', () => {
  it('start() spawns the process with the given command and args', () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const runner = createRealRunner();
    runner.start('ffmpeg', ['-i', 'rtsp://x']);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = spawnMock.mock.calls[0] as [string, string[], object];
    expect(cmd).toBe('ffmpeg');
    expect(args).toEqual(['-i', 'rtsp://x']);
    expect(opts).toMatchObject({ stdio: 'inherit' });
  });

  it('onExit handler receives the exit code when the process exits', () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const runner = createRealRunner();
    const proc = runner.start('ffmpeg', []);

    const codes: Array<number | null> = [];
    proc.onExit((code) => codes.push(code));

    child.emit('exit', 42);

    expect(codes).toEqual([42]);
  });

  it('onExit handler receives null when the process exits without a code', () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const runner = createRealRunner();
    const proc = runner.start('ffmpeg', []);

    const codes: Array<number | null> = [];
    proc.onExit((code) => codes.push(code));

    child.emit('exit', null);

    expect(codes).toEqual([null]);
  });

  it('kill() sends SIGTERM to the child process', () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);

    const runner = createRealRunner();
    const proc = runner.start('ffmpeg', []);

    proc.kill();

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });
});
