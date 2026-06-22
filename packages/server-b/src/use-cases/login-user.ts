import { Result, ok, err } from '@vss/shared';
import { UserRepository } from '../ports/user-repository';
import { PasswordHasher } from '../ports/password-hasher';
import { TokenIssuer } from '../ports/token-issuer';
import { SessionStore } from '../ports/session-store';
import { IdGenerator } from '../ports/id-generator';

export interface LoginUserDeps {
  readonly users: UserRepository;
  readonly hasher: PasswordHasher;
  readonly issuer: TokenIssuer;
  readonly sessions: SessionStore;
  readonly ids: IdGenerator;
  readonly ttlSeconds: number;
}

export const loginUser = async (
  req: { readonly login: string; readonly password: string },
  deps: LoginUserDeps,
): Promise<Result<{ token: string }, string>> => {
  const user = await deps.users.findByLogin(req.login);
  if (!user) return err('invalid credentials');
  const matches = await deps.hasher.compare(req.password, user.passwordHash);
  if (!matches) return err('invalid credentials');
  const jti = deps.ids.next();
  const token = await deps.issuer.issue({ sub: user.login, role: user.role, jti });
  await deps.sessions.create(jti, { login: user.login, role: user.role }, deps.ttlSeconds);
  return ok({ token });
};
