import { handleCommand, CommandContext } from '../handle-command';
import { createState, DeliveryState, clientConnected } from '../../domain/delivery-state';

const makeCtx = (initial: DeliveryState, nowMs = 0): CommandContext & { snapshot: () => DeliveryState } => {
  let current = initial;
  return {
    getState: () => current,
    setState: (s) => { current = s; },
    now: () => nowMs,
    snapshot: () => current,
  };
};

describe('handleCommand', () => {
  it('START_VIDEO turns delivery on', () => {
    const ctx = makeCtx(createState(0));
    const r = handleCommand('START_VIDEO', ctx);
    expect(r.ok).toBe(true);
    expect(ctx.snapshot().delivering).toBe(true);
  });
  it('STOP_VIDEO turns delivery off', () => {
    const ctx = makeCtx(createState(0));
    handleCommand('START_VIDEO', ctx);
    const r = handleCommand('STOP_VIDEO', ctx);
    expect(r.ok).toBe(true);
    expect(ctx.snapshot().delivering).toBe(false);
  });
  it('GET_STATUS reports delivery, clients, and uptime as text', () => {
    const ctx = makeCtx(clientConnected(createState(1000)), 4000);
    const r = handleCommand('GET_STATUS', ctx);
    expect(r.ok).toBe(true);
    expect(r.text).toBe('videoRunning=false clientsConnected=1 uptimeSec=3');
  });
  it('LOGOUT is not an A command and is reported as such', () => {
    const ctx = makeCtx(createState(0));
    const r = handleCommand('LOGOUT', ctx);
    expect(r.ok).toBe(false);
    expect(r.text).toContain('auth server');
  });
});
