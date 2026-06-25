import { createTpmCipher } from '../tpm-cipher';
import { TpmDevice } from '../tpm-device';

const mockDevice = (over: Partial<TpmDevice> = {}): TpmDevice => ({
  getPublicKey: async () => '-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----\n',
  decrypt: async () => Buffer.from('GET_STATUS', 'utf8'),
  exportPrivateKey: () => { throw new Error('cannot be exported'); },
  ...over,
});

describe('TpmCipher', () => {
  it('returns the device public key', async () => {
    expect(await createTpmCipher(mockDevice()).getPublicKey()).toContain('PUBLIC KEY');
  });
  it('decodes the device decryption result to a utf8 command', async () => {
    expect(await createTpmCipher(mockDevice()).decrypt(Buffer.from('x'))).toBe('GET_STATUS');
  });
  it('passes the ciphertext to the device unchanged', async () => {
    const decrypt = jest.fn(async () => Buffer.from('STOP_VIDEO'));
    const input = Buffer.from([9, 9]);
    await createTpmCipher(mockDevice({ decrypt })).decrypt(input);
    expect(decrypt).toHaveBeenCalledWith(input);
  });
});
