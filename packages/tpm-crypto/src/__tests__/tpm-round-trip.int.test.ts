import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { publicEncrypt, constants } from 'node:crypto';
import { createWindowsTpmDevice } from '../windows-tpm-device';

const BINARY = resolve(__dirname, '..', '..', 'build', 'Release', 'tpm_native.node');
const runReal = process.platform === 'win32' && existsSync(BINARY);
const describeIfTpm = runReal ? describe : describe.skip;

describeIfTpm('Windows TPM device round-trip (real hardware)', () => {
  it('persists a key, exports its public key, and decrypts an OAEP ciphertext in the TPM', async () => {
    const device = await createWindowsTpmDevice('vss-tpm-itest-key');
    const publicPem = await device.getPublicKey();
    expect(publicPem).toContain('PUBLIC KEY');

    const ciphertext = publicEncrypt(
      { key: publicPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from('STOP_VIDEO', 'utf8'),
    );
    expect((await device.decrypt(ciphertext)).toString('utf8')).toBe('STOP_VIDEO');
  }, 30000);
});
