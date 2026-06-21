import { JwtClaims, Result } from '@vss/shared';

// Verifies a presented JWT with Server A's RSA public key.
export interface TokenVerifier {
  verify(token: string): Promise<Result<JwtClaims, string>>;
}
