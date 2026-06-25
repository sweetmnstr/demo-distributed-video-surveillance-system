import { CommandCipher } from '@vss/shared';
import { TpmDevice } from './tpm-device';

// Adapts a TpmDevice to the CommandCipher port. The private key stays inside the
// device; this wrapper only forwards ciphertext in and decodes plaintext out.
export const createTpmCipher = (device: TpmDevice): CommandCipher => ({
  getPublicKey: () => device.getPublicKey(),
  decrypt: async (ciphertext) => (await device.decrypt(ciphertext)).toString('utf8'),
});
