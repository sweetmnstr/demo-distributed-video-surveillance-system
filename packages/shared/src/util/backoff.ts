export interface BackoffConfig {
  readonly baseMs: number;
  readonly capMs: number;
}

export const nextDelayMs = (attempt: number, config: BackoffConfig): number =>
  Math.min(config.capMs, config.baseMs * 2 ** attempt);
