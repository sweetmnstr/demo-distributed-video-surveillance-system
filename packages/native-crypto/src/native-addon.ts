import bindings from 'bindings';

// Typed contract for the compiled addon (TASK.md interface).
export interface NativeAddon {
  generateKeyPair(): Promise<void>;
  getPublicKey(): Promise<string>;
  decryptWithPrivateKey(ciphertext: Buffer): Promise<Buffer>;
}

// Loads build/Release/native_crypto.node via node-bindings.
export const loadNativeAddon = (): NativeAddon => bindings('native_crypto') as NativeAddon;
