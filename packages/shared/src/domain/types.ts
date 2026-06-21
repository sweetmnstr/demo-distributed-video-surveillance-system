export type Role = 'viewer' | 'operator';

export interface User {
  readonly login: string;
  readonly passwordHash: string;
  readonly role: Role;
}

export interface JwtClaims {
  readonly sub: string;
  readonly role: Role;
  readonly jti: string;
  readonly iat: number;
  readonly exp: number;
}

export interface Session {
  readonly login: string;
  readonly role: Role;
  readonly jti: string;
}
