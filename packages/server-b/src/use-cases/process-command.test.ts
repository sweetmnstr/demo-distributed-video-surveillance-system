import { processCommand } from './process-command';
import { Session } from '@vss/shared';

const operator: Session = { login: 'op', role: 'operator', jti: 'jti-1' };
const viewer: Session = { login: 'vw', role: 'viewer', jti: 'jti-2' };

describe('processCommand', () => {
  it('logs receipt, forwards an authorized command, and logs the result', async () => {
    const append = jest.fn(async () => {});
    const forward = jest.fn(async () => ({ ok: true, text: 'video delivery stopped' }));
    const reply = await processCommand('STOP_VIDEO', operator, { audit: { append }, forwarder: { forward } });
    expect(reply).toEqual({ ok: true, text: 'video delivery stopped' });
    expect(forward).toHaveBeenCalledWith('STOP_VIDEO');
    expect(append).toHaveBeenCalledWith('op', 'RECV STOP_VIDEO');
    expect(append).toHaveBeenCalledWith('op', 'RESULT STOP_VIDEO ok=true');
  });
  it('denies an unauthorized command, logs the denial, and does not forward', async () => {
    const append = jest.fn(async () => {});
    const forward = jest.fn(async () => ({ ok: true, text: 'x' }));
    const reply = await processCommand('STOP_VIDEO', viewer, { audit: { append }, forwarder: { forward } });
    expect(reply.ok).toBe(false);
    expect(reply.text).toContain('insufficient role');
    expect(forward).not.toHaveBeenCalled();
    expect(append).toHaveBeenCalledWith('vw', 'DENIED STOP_VIDEO');
  });
});
