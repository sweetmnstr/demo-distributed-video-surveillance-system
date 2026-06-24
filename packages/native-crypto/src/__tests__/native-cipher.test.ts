import { createNativeCryptoCipher } from '../native-cipher';
import { NativeAddon } from '../native-addon';

const mockAddon = (over: Partial<NativeAddon> = {}): NativeAddon => ({
  generateKeyPair: async () => {},
  getPublicKey: async () => '-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----\n',
  decryptWithPrivateKey: async () => Buffer.from('STOP_VIDEO', 'utf8'),
  ...over,
});

describe('NativeCryptoCipher', () => {
  it('returns the addon public key', async () => {
    const cipher = createNativeCryptoCipher(mockAddon());
    expect(await cipher.getPublicKey()).toContain('PUBLIC KEY');
  });
  it('decodes the decrypted buffer to a utf8 command', async () => {
    const cipher = createNativeCryptoCipher(mockAddon());
    expect(await cipher.decrypt(Buffer.from('cipher'))).toBe('STOP_VIDEO');
  });
  it('forwards the ciphertext buffer to the addon unchanged', async () => {
    const decryptWithPrivateKey = jest.fn(async () => Buffer.from('GET_STATUS'));
    const cipher = createNativeCryptoCipher(mockAddon({ decryptWithPrivateKey }));
    const input = Buffer.from([1, 2, 3]);
    await cipher.decrypt(input);
    expect(decryptWithPrivateKey).toHaveBeenCalledWith(input);
  });
});
