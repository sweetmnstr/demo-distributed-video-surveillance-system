import { readFile } from 'node:fs/promises';
import { verifyAccessToken } from '@vss/shared';
import { TokenVerifier } from '../ports/token-verifier';

// Loads the RSA public key once and verifies tokens with it (RS256).
export const createJoseTokenVerifier = async (publicKeyPath: string): Promise<TokenVerifier> => {
  const publicKeyPem = await readFile(publicKeyPath, 'utf8');
  return { verify: (token) => verifyAccessToken(token, publicKeyPem) };
};
