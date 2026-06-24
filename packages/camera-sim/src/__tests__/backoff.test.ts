import { nextDelayMs } from '../backoff';

describe('nextDelayMs (exponential backoff with cap)', () => {
  it('doubles per attempt starting at the base', () => {
    expect(nextDelayMs(0, { baseMs: 500, capMs: 30000 })).toBe(500);
    expect(nextDelayMs(1, { baseMs: 500, capMs: 30000 })).toBe(1000);
    expect(nextDelayMs(2, { baseMs: 500, capMs: 30000 })).toBe(2000);
  });
  it('never exceeds the cap', () => {
    expect(nextDelayMs(20, { baseMs: 500, capMs: 30000 })).toBe(30000);
  });
});
