import { Logger } from '@vss/shared';
import { ProcessRunner } from './process-runner';
import { BackoffConfig, nextDelayMs } from './backoff';

// Only the info/warn channels are used here; defaulting to no-ops keeps the
// supervisor silent unless a real logger is injected (e.g. from main.ts).
type SupervisorLog = Pick<Logger, 'info' | 'warn'>;
const SILENT: SupervisorLog = { info: () => undefined, warn: () => undefined };

// A process that survives at least this long is treated as a recovered run, so
// the backoff counter resets. Shorter-lived runs are treated as a failing loop
// and back off exponentially toward capMs.
const DEFAULT_STABLE_MS = 10000;

export interface SupervisorBackoff extends BackoffConfig {
  readonly stableMs?: number;
}

// Starts the process and restarts it whenever it exits. Rapid consecutive
// failures back off exponentially; a process that ran longer than stableMs
// resets the backoff. Returns a stop() function that halts supervision.
export const startSupervisor = (
  runner: ProcessRunner,
  command: string,
  args: string[],
  backoff: SupervisorBackoff,
  log: SupervisorLog = SILENT,
  now: () => number = Date.now,
): (() => void) => {
  const stableMs = backoff.stableMs ?? DEFAULT_STABLE_MS;
  let attempt = 0;
  let stopped = false;
  let current: { kill(): void } | null = null;

  const launch = (): void => {
    if (stopped) return;
    log.info('camera ffmpeg starting');
    const startedAt = now();
    const proc = runner.start(command, args);
    current = proc;
    proc.onExit(() => {
      if (stopped) return;
      const ranFor = now() - startedAt;
      attempt = ranFor >= stableMs ? 0 : attempt + 1;
      const delay = nextDelayMs(attempt, backoff);
      log.warn(`camera ffmpeg exited; restarting in ${delay}ms`);
      setTimeout(launch, delay);
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
