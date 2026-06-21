import { startSupervisor } from './supervisor';
import { ProcessRunner, RunningProcess } from './process-runner';

class FakeProcess implements RunningProcess {
  private handler: (code: number | null) => void = () => {};
  killed = false;
  kill() { this.killed = true; }
  onExit(h: (code: number | null) => void) { this.handler = h; }
  emitExit(code: number | null) { this.handler(code); }
}

class FakeRunner implements ProcessRunner {
  started: Array<{ command: string; args: string[] }> = [];
  processes: FakeProcess[] = [];
  start(command: string, args: string[]): RunningProcess {
    this.started.push({ command, args });
    const p = new FakeProcess();
    this.processes.push(p);
    return p;
  }
}

describe('startSupervisor', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts the process once immediately', () => {
    const runner = new FakeRunner();
    startSupervisor(runner, 'ffmpeg', ['-x'], { baseMs: 500, capMs: 30000 });
    expect(runner.started).toHaveLength(1);
    expect(runner.started[0]).toEqual({ command: 'ffmpeg', args: ['-x'] });
  });

  it('restarts after the process exits, honoring backoff', () => {
    const runner = new FakeRunner();
    startSupervisor(runner, 'ffmpeg', ['-x'], { baseMs: 500, capMs: 30000 });
    runner.processes[0].emitExit(1);
    expect(runner.started).toHaveLength(1); // waiting for backoff
    jest.advanceTimersByTime(500);
    expect(runner.started).toHaveLength(2);
  });

  it('resets backoff after a restart cycle', () => {
    const runner = new FakeRunner();
    startSupervisor(runner, 'ffmpeg', ['-x'], { baseMs: 500, capMs: 30000 });
    runner.processes[0].emitExit(1);
    jest.advanceTimersByTime(500);
    runner.processes[1].emitExit(1);
    jest.advanceTimersByTime(500);
    expect(runner.started).toHaveLength(3);
  });

  it('stop() kills the current process and prevents restart', () => {
    const runner = new FakeRunner();
    const stop = startSupervisor(runner, 'ffmpeg', ['-x'], { baseMs: 500, capMs: 30000 });
    stop();
    expect(runner.processes[0].killed).toBe(true);
    runner.processes[0].emitExit(null);
    jest.advanceTimersByTime(60000);
    expect(runner.started).toHaveLength(1);
  });

  it('stop() during backoff timer prevents delayed restart', () => {
    const runner = new FakeRunner();
    const stop = startSupervisor(runner, 'ffmpeg', ['-x'], { baseMs: 500, capMs: 30000 });
    runner.processes[0].emitExit(1); // schedules a 500ms restart timer
    stop();                           // sets stopped=true, kills current
    jest.advanceTimersByTime(500);    // timer fires → launch() hits early-return branch
    expect(runner.started).toHaveLength(1); // no restart happened
  });
});
