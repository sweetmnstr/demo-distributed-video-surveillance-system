import { authMessage, commandMessage } from './messages';
import { ControlClientMessage } from '@vss/shared';

describe('outgoing control messages', () => {
  it('builds a schema-valid auth message', () => {
    const m = authMessage('jwt');
    expect(() => ControlClientMessage.parse(m)).not.toThrow();
    expect(m).toEqual({ type: 'auth', token: 'jwt' });
  });
  it('builds a schema-valid command message', () => {
    const m = commandMessage('START_VIDEO');
    expect(() => ControlClientMessage.parse(m)).not.toThrow();
    expect(m).toEqual({ type: 'command', command: 'START_VIDEO' });
  });
});
