import { startSupervisor } from '../supervisor';
import { ProcessRunner, RunningProcess } from '../process-runner';

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
    jest.advanceTimersByTime(1000);
    expect(runner.started).toHaveLength(2);
  });

  it('escalates backoff across consecutive rapid failures', () => {
    const runner = new FakeRunner();
    let t = 0;
    startSupervisor(runner, 'ffmpeg', ['-x'], { baseMs: 500, capMs: 30000, stableMs: 10000 },
      undefined, () => t);
    runner.processes[0].emitExit(1);          // ran 0ms (< stableMs) -> attempt becomes 1
    jest.advanceTimersByTime(500);            // delay = nextDelayMs(1) = 1000? no: delay uses attempt after increment
    expect(runner.started).toHaveLength(1);   // 500ms not enough for the 1000ms delay
    jest.advanceTimersByTime(500);            // total 1000ms
    expect(runner.started).toHaveLength(2);
    runner.processes[1].emitExit(1);          // still rapid -> attempt becomes 2
    jest.advanceTimersByTime(2000);           // delay = nextDelayMs(2) = 2000
    expect(runner.started).toHaveLength(3);
  });

  it('resets backoff after a process runs longer than stableMs', () => {
    const runner = new FakeRunner();
    let t = 0;
    startSupervisor(runner, 'ffmpeg', ['-x'], { baseMs: 500, capMs: 30000, stableMs: 10000 },
      undefined, () => t);
    runner.processes[0].emitExit(1);          // rapid -> attempt 1
    jest.advanceTimersByTime(1000);           // relaunch
    expect(runner.started).toHaveLength(2);
    t = 20000;                                 // second process has now been up 20s (> stableMs)
    runner.processes[1].emitExit(1);          // stable run -> attempt resets to 0
    jest.advanceTimersByTime(500);            // delay = nextDelayMs(0) = baseMs = 500
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

  it('logs a start on launch and a warning with the backoff delay on exit', () => {
    const runner = new FakeRunner();
    const info: string[] = [];
    const warn: string[] = [];
    startSupervisor(runner, 'ffmpeg', ['-x'], { baseMs: 500, capMs: 30000 }, {
      info: (m: string) => info.push(m),
      warn: (m: string) => warn.push(m),
    });

    expect(info).toEqual(['camera ffmpeg starting']);

    runner.processes[0].emitExit(1);
    expect(warn).toEqual(['camera ffmpeg exited; restarting in 1000ms']);
  });

  it('stop() during backoff timer prevents delayed restart', () => {
    const runner = new FakeRunner();
    const stop = startSupervisor(runner, 'ffmpeg', ['-x'], { baseMs: 500, capMs: 30000 });
    runner.processes[0].emitExit(1); // schedules a restart timer
    stop();                           // sets stopped=true, kills current
    jest.advanceTimersByTime(1000);   // timer fires → launch() hits early-return branch
    expect(runner.started).toHaveLength(1); // no restart happened
  });
});
