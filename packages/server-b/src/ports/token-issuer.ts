import { Role } from '@vss/shared';

export interface TokenIssuer {
  issue(input: { readonly sub: string; readonly role: Role; readonly jti: string }): Promise<string>;
}
