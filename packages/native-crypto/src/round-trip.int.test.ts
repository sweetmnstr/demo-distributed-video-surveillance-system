import { publicEncrypt, constants } from 'node:crypto';
import { loadNativeAddon } from './native-addon';
import { createNativeCryptoCipher } from './native-cipher';

describe('native-crypto round-trip (built addon)', () => {
  it('generates a key, exports the public key, and decrypts an OAEP ciphertext', async () => {
    const addon = loadNativeAddon();
    await addon.generateKeyPair();
    const publicPem = await addon.getPublicKey();
    expect(publicPem).toContain('PUBLIC KEY');

    const ciphertext = publicEncrypt(
      { key: publicPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from('STOP_VIDEO', 'utf8'),
    );

    const cipher = createNativeCryptoCipher(addon);
    expect(await cipher.decrypt(ciphertext)).toBe('STOP_VIDEO');
  }, 30000);
});
