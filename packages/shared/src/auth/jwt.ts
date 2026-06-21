import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose';
import { Result, ok, err } from '../result/result';
import { JwtClaims, Role } from '../domain/types';

const ALG = 'RS256';

const VALID_ROLES: ReadonlySet<string> = Object.freeze(new Set<Role>(['viewer', 'operator']));

export interface TokenInput {
  readonly sub: string;
  readonly role: Role;
  readonly jti: string;
}

export const signAccessToken = async (
  input: TokenInput,
  privateKeyPem: string,
  ttlSeconds: number,
): Promise<string> => {
  const key = await importPKCS8(privateKeyPem, ALG);
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: input.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(input.sub)
    .setJti(input.jti)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(key);
};

export const verifyAccessToken = async (
  token: string,
  publicKeyPem: string,
): Promise<Result<JwtClaims, string>> => {
  try {
    const key = await importSPKI(publicKeyPem, ALG);
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] });
    const { sub, jti, iat, exp } = payload;
    if (
      typeof sub !== 'string' || sub === '' ||
      typeof jti !== 'string' || jti === '' ||
      typeof iat !== 'number' ||
      typeof exp !== 'number'
    ) {
      return err('token is missing required claims');
    }
    const rawRole = payload['role'];
    if (typeof rawRole !== 'string' || !VALID_ROLES.has(rawRole)) {
      return err('token contains invalid role');
    }
    return ok({ sub, role: rawRole as Role, jti, iat, exp });
  } catch (error) {
    return err(error instanceof Error ? error.message : 'invalid token');
  }
};
