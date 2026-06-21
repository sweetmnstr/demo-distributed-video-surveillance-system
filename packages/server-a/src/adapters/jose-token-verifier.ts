import { readFileSync } from 'node:fs';
import { verifyAccessToken } from '@vss/shared';
import { TokenVerifier } from '../ports/token-verifier';

// Loads the RSA public key once and verifies tokens with it (RS256).
export const createJoseTokenVerifier = (publicKeyPath: string): TokenVerifier => {
  const publicKeyPem = readFileSync(publicKeyPath, 'utf8');
  return { verify: (token) => verifyAccessToken(token, publicKeyPem) };
};
