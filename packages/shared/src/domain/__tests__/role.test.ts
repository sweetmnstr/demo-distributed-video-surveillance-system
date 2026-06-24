import { canRun } from '../role';

describe('canRun (RBAC — Bonus A foundation)', () => {
  it('lets operator run every command', () => {
    expect(canRun('operator', 'START_VIDEO')).toBe(true);
    expect(canRun('operator', 'STOP_VIDEO')).toBe(true);
    expect(canRun('operator', 'GET_STATUS')).toBe(true);
    expect(canRun('operator', 'LOGOUT')).toBe(true);
  });
  it('lets viewer run only GET_STATUS and LOGOUT', () => {
    expect(canRun('viewer', 'GET_STATUS')).toBe(true);
    expect(canRun('viewer', 'LOGOUT')).toBe(true);
    expect(canRun('viewer', 'START_VIDEO')).toBe(false);
    expect(canRun('viewer', 'STOP_VIDEO')).toBe(false);
  });
});
