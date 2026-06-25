// Tests for process-runner.ts — the file only exports TypeScript interfaces
// (RunningProcess and ProcessRunner), so there is no executable runtime code
// to instrument. These tests verify that the interface contract can be
// implemented correctly by a concrete class, exercising every declared member
// so Istanbul sees 100% branch/statement/function/line coverage on the file.
//
// Note: Istanbul counts interface declarations as 0 executable statements and
// therefore reports them as 100% covered automatically. The real coverage value
// of this file is architectural: it confirms the interfaces are usable.

import { ProcessRunner, RunningProcess } from '../process-runner';

// A minimal concrete implementation of the interfaces defined in process-runner.ts.
class TestProcess implements RunningProcess {
  private exitHandler: ((code: number | null) => void) | null = null;
  public killCalled = false;

  kill(): void {
    this.killCalled = true;
  }

  onExit(handler: (code: number | null) => void): void {
    this.exitHandler = handler;
  }

  // Helper used in tests to trigger the registered exit handler.
  triggerExit(code: number | null): void {
    this.exitHandler?.(code);
  }
}

class TestRunner implements ProcessRunner {
  public lastCommand = '';
  public lastArgs: string[] = [];
  private process = new TestProcess();

  start(command: string, args: string[]): RunningProcess {
    this.lastCommand = command;
    this.lastArgs = args;
    return this.process;
  }

  getProcess(): TestProcess {
    return this.process;
  }
}

describe('ProcessRunner / RunningProcess interfaces', () => {
  it('ProcessRunner.start() returns a RunningProcess', () => {
    const runner = new TestRunner();
    const proc = runner.start('cmd', ['--flag']);
    expect(proc).toBeDefined();
    expect(runner.lastCommand).toBe('cmd');
    expect(runner.lastArgs).toEqual(['--flag']);
  });

  it('RunningProcess.kill() can be called without throwing', () => {
    const runner = new TestRunner();
    const proc = runner.start('cmd', []);
    expect(() => proc.kill()).not.toThrow();
    expect(runner.getProcess().killCalled).toBe(true);
  });

  it('RunningProcess.onExit() registers a handler that fires with a numeric code', () => {
    const runner = new TestRunner();
    const proc = runner.start('cmd', []);
    const codes: Array<number | null> = [];
    proc.onExit((code) => codes.push(code));
    runner.getProcess().triggerExit(0);
    expect(codes).toEqual([0]);
  });

  it('RunningProcess.onExit() fires with null when no exit code is available', () => {
    const runner = new TestRunner();
    const proc = runner.start('cmd', []);
    const codes: Array<number | null> = [];
    proc.onExit((code) => codes.push(code));
    runner.getProcess().triggerExit(null);
    expect(codes).toEqual([null]);
  });
});
