import { generateKeyPairSync, publicEncrypt, constants } from 'node:crypto';
import { createNodeCryptoCipher } from '../node-cipher';

const keys = () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
};

const encryptOaep = (publicPem: string, plaintext: string): Buffer =>
  publicEncrypt(
    { key: publicPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(plaintext, 'utf8'),
  );

describe('NodeCryptoCipher (RSA-OAEP SHA-256)', () => {
  it('returns the configured public key', async () => {
    const { privatePem, publicPem } = keys();
    const cipher = createNodeCryptoCipher(privatePem, publicPem);
    expect(await cipher.getPublicKey()).toBe(publicPem);
  });
  it('decrypts what was encrypted with the matching public key', async () => {
    const { privatePem, publicPem } = keys();
    const cipher = createNodeCryptoCipher(privatePem, publicPem);
    const ciphertext = encryptOaep(publicPem, 'STOP_VIDEO');
    expect(await cipher.decrypt(ciphertext)).toBe('STOP_VIDEO');
  });
});
