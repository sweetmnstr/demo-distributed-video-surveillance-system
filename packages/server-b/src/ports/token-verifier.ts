import { JwtClaims, Result } from '@vss/shared';

export interface TokenVerifier {
  verify(token: string): Promise<Result<JwtClaims, string>>;
}
