// Models a key sealed in a TPM: decryption happens inside the device and the
// private key can never be exported (exportPrivateKey always throws).
export interface TpmDevice {
  getPublicKey(): Promise<string>;
  decrypt(ciphertext: Buffer): Promise<Buffer>;
  exportPrivateKey(): never;
}
