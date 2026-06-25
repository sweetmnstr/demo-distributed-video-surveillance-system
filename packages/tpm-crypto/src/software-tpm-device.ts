import { generateKeyPairSync, privateDecrypt, constants } from 'node:crypto';
import { TpmDevice } from './tpm-device';

// Emulates a TPM-sealed key: the private KeyObject lives only in this closure,
// is never returned, and decryption is performed internally. exportPrivateKey
// always throws, mirroring a non-exportable hardware key.
export const createSoftwareTpmDevice = (): TpmDevice => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  return {
    getPublicKey: async () => publicPem,
    decrypt: async (ciphertext) =>
      privateDecrypt(
        { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
        ciphertext,
      ),
    exportPrivateKey: () => {
      throw new Error('private key is sealed in the TPM and cannot be exported');
    },
  };
};
