import { createLogger } from '../logger';

describe('createLogger', () => {
  const fixedClock = () => new Date('2026-06-26T12:00:00.000Z');

  it('formats each level with timestamp, component tag, and message', () => {
    const lines: string[] = [];
    const log = createLogger('server-a', (line) => lines.push(line), fixedClock);

    log.info('ingest started');
    log.warn('reconnecting');
    log.error('fatal');

    expect(lines).toEqual([
      '2026-06-26T12:00:00.000Z [server-a] INFO ingest started',
      '2026-06-26T12:00:00.000Z [server-a] WARN reconnecting',
      '2026-06-26T12:00:00.000Z [server-a] ERROR fatal',
    ]);
  });

  it('writes to console.log and uses the system clock by default', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      createLogger('camera-sim').info('hello');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]![0]).toMatch(
        /^\d{4}-\d{2}-\d{2}T[\d:.]+Z \[camera-sim\] INFO hello$/,
      );
    } finally {
      spy.mockRestore();
    }
  });
});
