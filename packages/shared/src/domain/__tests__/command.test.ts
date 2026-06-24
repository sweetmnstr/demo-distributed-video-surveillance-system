import { parseCommand, COMMANDS } from '../command';
import { isOk, isErr } from '../../result/result';

describe('parseCommand', () => {
  it.each(COMMANDS)('accepts %s case-insensitively with whitespace', (cmd) => {
    const r = parseCommand(`  ${cmd.toLowerCase()}  `);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value).toBe(cmd);
  });
  it('rejects an unknown command', () => {
    const r = parseCommand('DELETE_EVERYTHING');
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error).toContain('unknown command');
  });
  it('rejects an empty command', () => {
    const r = parseCommand('   ');
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error).toBe('empty command');
  });
});
