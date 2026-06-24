import { decryptCommand } from '../decrypt-command';
import { CommandCipher, isOk, isErr } from '@vss/shared';

const cipherReturning = (plaintext: string): CommandCipher => ({
  getPublicKey: async () => 'pem',
  decrypt: async () => plaintext,
});

describe('decryptCommand', () => {
  it('decrypts and validates a known command', async () => {
    const r = await decryptCommand(Buffer.from('x').toString('base64'), cipherReturning('STOP_VIDEO'));
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value).toBe('STOP_VIDEO');
  });
  it('rejects an unknown decrypted command', async () => {
    const r = await decryptCommand('Zm9v', cipherReturning('DROP_TABLE'));
    expect(isErr(r)).toBe(true);
  });
  it('returns an error when decryption throws', async () => {
    const cipher: CommandCipher = { getPublicKey: async () => 'pem', decrypt: async () => { throw new Error('bad padding'); } };
    const r = await decryptCommand('Zm9v', cipher);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error).toContain('decryption failed');
  });
});
