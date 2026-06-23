export interface AuthStore {
  setToken(token: string): void;
  getToken(): string | null;
  clear(): void;
  isAuthenticated(): boolean;
}

// JWT lives in a closure variable, never in localStorage/sessionStorage, so a
// reflected-XSS payload cannot read it from persistent storage.
export const createAuthStore = (): AuthStore => {
  let token: string | null = null;
  return {
    setToken: (value) => { token = value; },
    getToken: () => token,
    clear: () => { token = null; },
    isAuthenticated: () => token !== null,
  };
};
