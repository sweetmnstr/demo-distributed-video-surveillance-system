// Revocation lookup against the shared Redis session store.
export interface SessionStore {
  isActive(jti: string): Promise<boolean>;
}
