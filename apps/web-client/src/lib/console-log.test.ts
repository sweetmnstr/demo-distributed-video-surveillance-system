import { outgoing, serverResponse, connectionError, appendLine } from './console-log';

describe('console log formatting', () => {
  it('formats an outgoing command', () => {
    expect(outgoing('STOP_VIDEO')).toEqual({ kind: 'out', text: '> STOP_VIDEO' });
  });
  it('formats a successful server response', () => {
    expect(serverResponse(true, 'video delivery stopped'))
      .toEqual({ kind: 'response', text: '< OK: video delivery stopped' });
  });
  it('formats a command-execution error from the server', () => {
    expect(serverResponse(false, 'insufficient role'))
      .toEqual({ kind: 'cmd-error', text: '< ERROR: insufficient role' });
  });
  it('formats a connection error', () => {
    expect(connectionError('socket closed'))
      .toEqual({ kind: 'conn-error', text: '! CONNECTION: socket closed' });
  });
  it('appends immutably', () => {
    const a = [outgoing('GET_STATUS')];
    const b = appendLine(a, serverResponse(true, 'ok'));
    expect(b).toHaveLength(2);
    expect(a).toHaveLength(1); // original untouched
  });
});
