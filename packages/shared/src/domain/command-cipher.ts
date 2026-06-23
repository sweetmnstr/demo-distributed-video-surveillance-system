// Single decryption seam for the bonus chain (Node / native addon / TPM). The
// use-cases depend only on this port and never learn which implementation runs.
export interface CommandCipher {
  getPublicKey(): Promise<string>;
  decrypt(ciphertext: Buffer): Promise<string>;
}
