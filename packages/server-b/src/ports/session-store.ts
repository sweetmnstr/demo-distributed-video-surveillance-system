import { Role } from '@vss/shared';

export interface SessionStore {
  create(jti: string, session: { readonly login: string; readonly role: Role }, ttlSeconds: number): Promise<void>;
  isActive(jti: string): Promise<boolean>;
  revoke(jti: string): Promise<void>;
}
