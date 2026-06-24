import { readFile } from 'node:fs/promises';
import { signAccessToken } from '@vss/shared';
import { TokenIssuer } from '../ports/token-issuer';

export const createJoseTokenIssuer = async (privateKeyPath: string, ttlSeconds: number): Promise<TokenIssuer> => {
  const privateKeyPem = await readFile(privateKeyPath, 'utf8');
  return { issue: (input) => signAccessToken(input, privateKeyPem, ttlSeconds) };
};
