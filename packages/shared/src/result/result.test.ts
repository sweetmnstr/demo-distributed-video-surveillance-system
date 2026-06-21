import { ok, err, isOk, isErr, map, unwrapOr, Result } from './result';

describe('Result', () => {
  it('constructs ok and err', () => {
    expect(ok(1)).toEqual({ kind: 'ok', value: 1 });
    expect(err('boom')).toEqual({ kind: 'err', error: 'boom' });
  });
  it('narrows with isOk / isErr', () => {
    const good: Result<number, string> = ok(1);
    const bad: Result<number, string> = err('x');
    expect(isOk(good)).toBe(true);
    expect(isErr(good)).toBe(false);
    expect(isOk(bad)).toBe(false);
    expect(isErr(bad)).toBe(true);
  });
  it('maps ok values and passes err through', () => {
    expect(map(ok(2), (n) => n * 3)).toEqual(ok(6));
    expect(map(err<string>('e'), (n: number) => n * 3)).toEqual(err('e'));
  });
  it('unwrapOr returns value or fallback', () => {
    expect(unwrapOr(ok(5), 0)).toBe(5);
    expect(unwrapOr(err('e'), 0)).toBe(0);
  });
});
