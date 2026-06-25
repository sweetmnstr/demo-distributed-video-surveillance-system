import { createUuidIdGenerator } from '../uuid-id-generator';

describe('uuid-id-generator', () => {
  it('produces v4-shaped UUIDs', () => {
    const gen = createUuidIdGenerator();
    const id = gen.next();
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('produces unique ids on each call', () => {
    const gen = createUuidIdGenerator();
    const a = gen.next();
    const b = gen.next();
    expect(a).not.toBe(b);
  });
});
