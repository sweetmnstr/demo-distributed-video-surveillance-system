export type Result<T, E> = { kind: 'ok'; value: T } | { kind: 'err'; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ kind: 'ok', value });
export const err = <E>(error: E): Result<never, E> => ({ kind: 'err', error });

export const isOk = <T, E>(r: Result<T, E>): r is { kind: 'ok'; value: T } => r.kind === 'ok';
export const isErr = <T, E>(r: Result<T, E>): r is { kind: 'err'; error: E } => r.kind === 'err';

export const map = <T, U, E>(r: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  r.kind === 'ok' ? ok(fn(r.value)) : err(r.error);

export const unwrapOr = <T, E>(r: Result<T, E>, fallback: T): T =>
  r.kind === 'ok' ? r.value : fallback;
