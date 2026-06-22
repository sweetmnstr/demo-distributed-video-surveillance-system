import { readFileSync } from 'node:fs';
import { verifyAccessToken } from '@vss/shared';
import { TokenVerifier } from '../ports/token-verifier';

export const createJoseTokenVerifier = (publicKeyPath: string): TokenVerifier => {
  const publicKeyPem = readFileSync(publicKeyPath, 'utf8');
  return { verify: (token) => verifyAccessToken(token, publicKeyPem) };
};
