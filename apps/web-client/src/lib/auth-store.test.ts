import { createAuthStore, isTokenExpired } from './auth-store';

// Builds a JWT-shaped string `header.payload.sig` whose payload carries `exp` (seconds).
const tokenWithExp = (expSeconds: number): string =>
  `h.${btoa(JSON.stringify({ exp: expSeconds }))}.s`;

const NOW_MS = 1_000_000_000_000; // fixed "now" for deterministic expiry checks

beforeEach(() => localStorage.clear());

describe('isTokenExpired', () => {
  it('returns false for a token whose exp is in the future', () => {
    expect(isTokenExpired(tokenWithExp(NOW_MS / 1000 + 60), NOW_MS)).toBe(false);
  });

  it('returns true for a token whose exp is in the past', () => {
    expect(isTokenExpired(tokenWithExp(NOW_MS / 1000 - 60), NOW_MS)).toBe(true);
  });

  it('returns true when exp is missing or not a number', () => {
    expect(isTokenExpired(`h.${btoa(JSON.stringify({ sub: 'x' }))}.s`, NOW_MS)).toBe(true);
  });

  it('returns true for a malformed token', () => {
    expect(isTokenExpired('not-a-jwt', NOW_MS)).toBe(true);
  });
});

describe('createAuthStore', () => {
  it('persists and returns a valid token', () => {
    const store = createAuthStore();
    const token = tokenWithExp(Date.now() / 1000 + 3600);
    store.setToken(token);
    expect(store.getToken()).toBe(token);
    expect(store.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('vss.token')).toBe(token);
  });

  it('returns null when no token is stored', () => {
    const store = createAuthStore();
    expect(store.getToken()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('clears and returns null for an expired token', () => {
    const store = createAuthStore();
    store.setToken(tokenWithExp(Date.now() / 1000 - 60));
    expect(store.getToken()).toBeNull();
    expect(localStorage.getItem('vss.token')).toBeNull();
  });

  it('clear() removes the stored token', () => {
    const store = createAuthStore();
    store.setToken(tokenWithExp(Date.now() / 1000 + 3600));
    store.clear();
    expect(localStorage.getItem('vss.token')).toBeNull();
  });
});
