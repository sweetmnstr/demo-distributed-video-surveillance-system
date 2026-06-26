const TOKEN_KEY = 'vss.token';

// Decodes a JWT's `exp` (seconds) and reports whether it is in the past. Any
// malformed/unparseable token is treated as expired so callers never trust it.
export const isTokenExpired = (token: string, nowMs: number): boolean => {
  try {
    const segment = token.split('.')[1] ?? '';
    const json = atob(segment.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(json) as { exp?: number };
    if (typeof exp !== 'number') return true;
    return exp * 1000 <= nowMs;
  } catch {
    return true;
  }
};

export interface AuthStore {
  setToken(token: string): void;
  getToken(): string | null;
  clear(): void;
  isAuthenticated(): boolean;
}

// Persists the JWT in localStorage so a page reload keeps the session. An expired
// or malformed token is cleared on read. Tradeoff vs. the previous in-memory store:
// localStorage is readable by XSS — accepted for this prototype (see SOLUTION.md).
export const createAuthStore = (): AuthStore => {
  const getToken = (): string | null => {
    const value = localStorage.getItem(TOKEN_KEY);
    if (value === null) return null;
    if (isTokenExpired(value, Date.now())) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return value;
  };
  return {
    setToken: (value) => localStorage.setItem(TOKEN_KEY, value),
    getToken,
    clear: () => localStorage.removeItem(TOKEN_KEY),
    isAuthenticated: () => getToken() !== null,
  };
};
