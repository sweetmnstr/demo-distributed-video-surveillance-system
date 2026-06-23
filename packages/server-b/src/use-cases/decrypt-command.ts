import { Result, err, parseCommand, Command, CommandCipher } from '@vss/shared';

// Turns a base64 RSA-OAEP ciphertext into a validated Command. Reuses the shared
// parseCommand so encrypted and plaintext paths accept exactly the same commands.
export const decryptCommand = async (
  payloadBase64: string,
  cipher: CommandCipher,
): Promise<Result<Command, string>> => {
  try {
    const plaintext = await cipher.decrypt(Buffer.from(payloadBase64, 'base64'));
    return parseCommand(plaintext);
  } catch {
    return err('decryption failed');
  }
};
