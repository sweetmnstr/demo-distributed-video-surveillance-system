// A tiny structured logger shared across services. Each line is prefixed with an
// ISO timestamp and the component name so interleaved service output stays legible:
//
//   2026-06-26T12:00:00.000Z [server-a] INFO client connected (1 viewer)
//
// The sink and clock are injectable so callers can capture output in tests; in
// production they default to console.log and the system clock.
export interface Logger {
  readonly info: (message: string) => void;
  readonly warn: (message: string) => void;
  readonly error: (message: string) => void;
}

export const createLogger = (
  component: string,
  sink: (line: string) => void = (line) => console.log(line),
  clock: () => Date = () => new Date(),
): Logger => {
  const emit = (level: string, message: string): void =>
    sink(`${clock().toISOString()} [${component}] ${level} ${message}`);
  return {
    info: (message) => emit('INFO', message),
    warn: (message) => emit('WARN', message),
    error: (message) => emit('ERROR', message),
  };
};
