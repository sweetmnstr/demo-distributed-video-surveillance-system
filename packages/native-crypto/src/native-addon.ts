import bindings from 'bindings';

export interface NativeAddon {
  generateKeyPair(): Promise<void>;
  getPublicKey(): Promise<string>;
  decryptWithPrivateKey(ciphertext: Buffer): Promise<Buffer>;
}

export const loadNativeAddon = (): NativeAddon => bindings('native_crypto') as NativeAddon;
