import { publicEncrypt, constants } from 'node:crypto';
import { createSoftwareTpmDevice } from './software-tpm-device';

describe('SoftwareTpmDevice (emulated sealed key)', () => {
  it('exposes a public key and decrypts inside the device', async () => {
    const device = createSoftwareTpmDevice();
    const publicPem = await device.getPublicKey();
    expect(publicPem).toContain('PUBLIC KEY');
    const ciphertext = publicEncrypt(
      { key: publicPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from('STOP_VIDEO', 'utf8'),
    );
    expect((await device.decrypt(ciphertext)).toString('utf8')).toBe('STOP_VIDEO');
  });
  it('refuses to export the private key (non-exportable invariant)', () => {
    const device = createSoftwareTpmDevice();
    expect(() => device.exportPrivateKey()).toThrow(/cannot be exported/);
  });
});
