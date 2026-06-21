import { Result, ok, err, isErr, Session } from '@vss/shared';
import { TokenVerifier } from '../ports/token-verifier';
import { SessionStore } from '../ports/session-store';

export interface AuthorizeViewerDeps {
  readonly verifier: TokenVerifier;
  readonly sessions: SessionStore;
}

export const authorizeViewer = async (
  token: string,
  deps: AuthorizeViewerDeps,
): Promise<Result<Session, string>> => {
  const verified = await deps.verifier.verify(token);
  if (isErr(verified)) return err('invalid token');
  const { sub, role, jti } = verified.value;
  const active = await deps.sessions.isActive(jti);
  if (!active) return err('session revoked');
  return ok({ login: sub, role, jti });
};
