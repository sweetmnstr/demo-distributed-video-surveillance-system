import { TpmDevice } from './tpm-device';
import { rsaComponentsToSpkiPem } from './rsa-public-key';
import { loadTpmAddon, type TpmNativeAddon } from './tpm-native';

// Extracts a human-readable message from an unknown thrown value.
// Uses a cross-realm–safe check: native Node addons are loaded in the V8
// global context so their Error objects may not satisfy `instanceof Error`
// when caught inside a Jest sandbox (different realm). We therefore also
// accept any object that carries a string `message` property.
const extractDetail = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (
    err !== null &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as Record<string, unknown>)['message'] === 'string'
  ) {
    return (err as Record<string, unknown>)['message'] as string;
  }
  return 'unknown error';
};

// Real Windows TPM device backed by the CNG Platform Crypto Provider. The
// RSA private key is created/persisted inside the TPM and is non-exportable;
// decryption happens in hardware. `addon` is injectable for testing.
export const createWindowsTpmDevice = async (
  keyName: string,
  addon?: TpmNativeAddon,
): Promise<TpmDevice> => {
  // istanbul ignore next -- native-hardware DI seam: loadTpmAddon() runs only in
  // production (no addon injected); it is exercised by the Windows round-trip test.
  const device = addon ?? loadTpmAddon();
  try {
    await device.openOrCreateKey(keyName);
    const { modulus, exponent } = await device.getPublicKeyComponents();
    const publicPem = rsaComponentsToSpkiPem(modulus, exponent);
    return {
      getPublicKey: async () => publicPem,
      decrypt: (ciphertext) => device.decrypt(ciphertext),
      exportPrivateKey: () => {
        throw new Error('private key is sealed in the TPM and cannot be exported');
      },
    };
  } catch (error: unknown) {
    throw new Error(`Failed to initialize Windows TPM device for key '${keyName}': ${extractDetail(error)}`);
  }
};
