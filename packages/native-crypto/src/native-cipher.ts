import { CommandCipher } from '@vss/shared';
import { NativeAddon } from './native-addon';

// Adapts the native addon to the CommandCipher port. Pure given the addon, so
// it is unit-tested to 100% with a mock; the real addon is exercised by the
// round-trip integration test.
export const createNativeCryptoCipher = (addon: NativeAddon): CommandCipher => ({
  getPublicKey: () => addon.getPublicKey(),
  decrypt: async (ciphertext) => (await addon.decryptWithPrivateKey(ciphertext)).toString('utf8'),
});
