import { createReconnectController } from './reconnect';

const fakeScheduler = () => {
  const queue: Array<{ fn: () => void; ms: number }> = [];
  return {
    schedule: (fn: () => void, ms: number) => { queue.push({ fn, ms }); },
    runNext: (): number | undefined => { const job = queue.shift(); if (job) job.fn(); return job?.ms; },
    size: () => queue.length,
  };
};

describe('reconnect controller', () => {
  const backoff = { baseMs: 500, capMs: 30000 };

  it('connects immediately on start', () => {
    const connect = jest.fn();
    const sched = fakeScheduler();
    const c = createReconnectController({ connect, schedule: sched.schedule, backoff });
    c.start();
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('reconnects after a close, honoring backoff', () => {
    const connect = jest.fn();
    const sched = fakeScheduler();
    const c = createReconnectController({ connect, schedule: sched.schedule, backoff });
    c.start();
    c.onClose();
    expect(connect).toHaveBeenCalledTimes(1); // waiting on backoff
    expect(sched.runNext()).toBe(500);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('increases the delay on consecutive closes and resets after an open', () => {
    const connect = jest.fn();
    const sched = fakeScheduler();
    const c = createReconnectController({ connect, schedule: sched.schedule, backoff });
    c.start();
    c.onClose();
    expect(sched.runNext()).toBe(500);
    c.onClose();
    expect(sched.runNext()).toBe(1000); // attempt grew
    c.onOpen();                          // success resets the counter
    c.onClose();
    expect(sched.runNext()).toBe(500);
  });
});
