import { emptyQueue, enqueue, onUpdateEnd } from './mse-buffer';

const u = (n: number) => new Uint8Array([n]);

describe('MSE append queue', () => {
  it('appends immediately when idle', () => {
    const r = enqueue(emptyQueue(), u(1));
    expect(r.append).toEqual(u(1));
    expect(r.state.appending).toBe(true);
    expect(r.state.queue).toHaveLength(0);
  });
  it('queues a second chunk while the first is still appending', () => {
    const first = enqueue(emptyQueue(), u(1));
    const second = enqueue(first.state, u(2));
    expect(second.append).toBeNull();
    expect(second.state.queue).toEqual([u(2)]);
  });
  it('drains the next queued chunk on updateend', () => {
    const first = enqueue(emptyQueue(), u(1));
    const second = enqueue(first.state, u(2));
    const drained = onUpdateEnd(second.state);
    expect(drained.append).toEqual(u(2));
    expect(drained.state.queue).toHaveLength(0);
    expect(drained.state.appending).toBe(true);
  });
  it('returns to idle when the queue is empty on updateend', () => {
    const first = enqueue(emptyQueue(), u(1));
    const drained = onUpdateEnd(first.state);
    expect(drained.append).toBeNull();
    expect(drained.state.appending).toBe(false);
  });
});
