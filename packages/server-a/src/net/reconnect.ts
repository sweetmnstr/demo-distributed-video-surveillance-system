import { BackoffConfig, nextDelayMs } from '@vss/shared';

export interface ReconnectDeps {
  connect(): void;
  schedule(fn: () => void, ms: number): void;
  readonly backoff: BackoffConfig;
}

export interface ReconnectController {
  start(): void;
  onOpen(): void;
  onClose(): void;
}

// Drives connection lifecycle: connect once on start, and on every close
// schedule a reconnect using exponential backoff. A successful open resets
// the attempt counter so the next outage starts from the base delay.
export const createReconnectController = (deps: ReconnectDeps): ReconnectController => {
  let attempt = 0;

  const start = (): void => {
    deps.connect();
  };

  const onOpen = (): void => {
    attempt = 0;
  };

  const onClose = (): void => {
    const delay = nextDelayMs(attempt, deps.backoff);
    attempt += 1;
    deps.schedule(() => deps.connect(), delay);
  };

  return { start, onOpen, onClose };
};
