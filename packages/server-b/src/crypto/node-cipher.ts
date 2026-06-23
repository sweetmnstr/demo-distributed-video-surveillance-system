import { privateDecrypt, constants } from 'node:crypto';
import { CommandCipher } from '@vss/shared';

// RSA-OAEP (SHA-256) decryptor backed by Node's built-in crypto. Pure given the
// PEM strings, so it is unit-tested to 100% without any IO.
export const createNodeCryptoCipher = (privateKeyPem: string, publicKeyPem: string): CommandCipher => ({
  getPublicKey: async () => publicKeyPem,
  decrypt: async (ciphertext) =>
    privateDecrypt(
      { key: privateKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      ciphertext,
    ).toString('utf8'),
});
