// Port pattern: abstracting OS process management so the supervisor can be tested without spawning real processes.

export interface RunningProcess {
  kill(): void;
  onExit(handler: (code: number | null) => void): void;
}

export interface ProcessRunner {
  start(command: string, args: string[]): RunningProcess;
}
