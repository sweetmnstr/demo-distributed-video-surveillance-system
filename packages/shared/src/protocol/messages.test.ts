import { ControlClientMessage, ControlServerMessage, LoginRequest, InterServerCommand, InterServerResult } from './messages';

describe('control protocol schemas', () => {
  it('accepts a plaintext command message', () => {
    expect(ControlClientMessage.parse({ type: 'command', command: 'GET_STATUS' }))
      .toEqual({ type: 'command', command: 'GET_STATUS' });
  });
  it('accepts an encrypted command message (Bonus B)', () => {
    expect(ControlClientMessage.parse({ type: 'encrypted', payload: 'YmFzZTY0' }).type)
      .toBe('encrypted');
  });
  it('rejects an unknown command value', () => {
    expect(() => ControlClientMessage.parse({ type: 'command', command: 'NOPE' })).toThrow();
  });
  it('accepts a server response message', () => {
    expect(ControlServerMessage.parse({ type: 'response', ok: true, text: 'OK' }))
      .toEqual({ type: 'response', ok: true, text: 'OK' });
  });
  it('accepts a client auth message', () => {
    expect(ControlClientMessage.parse({ type: 'auth', token: 'some.jwt.token' }).type)
      .toBe('auth');
  });
  it('rejects an auth message with empty token', () => {
    expect(() => ControlClientMessage.parse({ type: 'auth', token: '' })).toThrow();
  });
  it('accepts a server error message', () => {
    expect(ControlServerMessage.parse({ type: 'error', text: 'boom' }))
      .toEqual({ type: 'error', text: 'boom' });
  });
  it('parses a valid LoginRequest', () => {
    expect(LoginRequest.parse({ login: 'alice', password: 'secret' }))
      .toEqual({ login: 'alice', password: 'secret' });
  });
  it('rejects a LoginRequest with empty login', () => {
    expect(() => LoginRequest.parse({ login: '', password: 'secret' })).toThrow();
  });
});

describe('A<->B inter-server protocol', () => {
  it('accepts an exec command from Server B', () => {
    expect(InterServerCommand.parse({ type: 'exec', requestId: 'r1', command: 'STOP_VIDEO' }))
      .toEqual({ type: 'exec', requestId: 'r1', command: 'STOP_VIDEO' });
  });
  it('rejects an unknown command in an exec message', () => {
    expect(() => InterServerCommand.parse({ type: 'exec', requestId: 'r1', command: 'NOPE' })).toThrow();
  });
  it('accepts a result message from Server A', () => {
    expect(InterServerResult.parse({ type: 'result', requestId: 'r1', ok: true, text: 'done' }))
      .toEqual({ type: 'result', requestId: 'r1', ok: true, text: 'done' });
  });
});
