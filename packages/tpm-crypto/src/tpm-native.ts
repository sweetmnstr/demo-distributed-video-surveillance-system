import bindings from 'bindings';

// Minimal surface over the Windows CNG Platform Crypto Provider addon. The
// addon returns raw bytes; all formatting/logic stays in TypeScript.
export interface TpmNativeAddon {
  openOrCreateKey(keyName: string): Promise<void>;
  getPublicKeyComponents(): Promise<{ modulus: Buffer; exponent: Buffer }>;
  decrypt(ciphertext: Buffer): Promise<Buffer>;
}

// Loads the compiled tpm_native addon. Throws a friendly error if it has not
// been built (e.g. on a non-Windows machine or before `npm install`).
export const loadTpmAddon = (): TpmNativeAddon => {
  try {
    return bindings('tpm_native') as TpmNativeAddon;
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`Windows TPM addon (tpm_native) is not available: ${detail}`);
  }
};
