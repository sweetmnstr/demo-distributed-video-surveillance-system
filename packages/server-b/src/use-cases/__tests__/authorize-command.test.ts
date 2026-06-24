import { authorizeCommand } from '../authorize-command';
import { isOk, isErr } from '@vss/shared';

describe('authorizeCommand (RBAC)', () => {
  it('allows an operator to START_VIDEO', () => {
    expect(isOk(authorizeCommand('operator', 'START_VIDEO'))).toBe(true);
  });
  it('allows a viewer to GET_STATUS', () => {
    expect(isOk(authorizeCommand('viewer', 'GET_STATUS'))).toBe(true);
  });
  it('denies a viewer STOP_VIDEO with an explanatory error', () => {
    const r = authorizeCommand('viewer', 'STOP_VIDEO');
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error).toContain('viewer');
  });
  it('allows an operator to STOP_VIDEO', () => {
    expect(isOk(authorizeCommand('operator', 'STOP_VIDEO'))).toBe(true);
  });
  it('allows a viewer to LOGOUT', () => {
    expect(isOk(authorizeCommand('viewer', 'LOGOUT'))).toBe(true);
  });
  it('denies a viewer START_VIDEO', () => {
    const r = authorizeCommand('viewer', 'START_VIDEO');
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error).toContain('viewer');
  });
  it('allows an operator to GET_STATUS', () => {
    expect(isOk(authorizeCommand('operator', 'GET_STATUS'))).toBe(true);
  });
});
