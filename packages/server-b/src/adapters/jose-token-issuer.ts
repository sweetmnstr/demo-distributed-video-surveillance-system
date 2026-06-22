import { readFileSync } from 'node:fs';
import { signAccessToken } from '@vss/shared';
import { TokenIssuer } from '../ports/token-issuer';

export const createJoseTokenIssuer = (privateKeyPath: string, ttlSeconds: number): TokenIssuer => {
  const privateKeyPem = readFileSync(privateKeyPath, 'utf8');
  return { issue: (input) => signAccessToken(input, privateKeyPem, ttlSeconds) };
};
