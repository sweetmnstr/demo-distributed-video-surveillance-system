import { ProcessRunner } from './process-runner';
import { BackoffConfig, nextDelayMs } from './backoff';

// Starts the process and restarts it whenever it exits, applying exponential
// backoff between attempts. Returns a stop() function that halts supervision.
export const startSupervisor = (
  runner: ProcessRunner,
  command: string,
  args: string[],
  backoff: BackoffConfig,
): (() => void) => {
  let attempt = 0;
  let stopped = false;
  let current: { kill(): void } | null = null;

  const launch = (): void => {
    if (stopped) return;
    const proc = runner.start(command, args);
    current = proc;
    proc.onExit(() => {
      if (stopped) return;
      const delay = nextDelayMs(attempt, backoff);
      attempt += 1;
      setTimeout(() => {
        attempt = 0;
        launch();
      }, delay);
    });
  };

  launch();

  return () => {
    stopped = true;
    // current is always non-null here: launch() assigns it synchronously before
    // this closure is returned to the caller.
    (current as NonNullable<typeof current>).kill();
  };
};
