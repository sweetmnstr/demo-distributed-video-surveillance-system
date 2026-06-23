import { createAuthStore } from './auth-store';

describe('auth store (in-memory only)', () => {
  it('starts empty and unauthenticated', () => {
    const store = createAuthStore();
    expect(store.getToken()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });
  it('holds a token after setToken', () => {
    const store = createAuthStore();
    store.setToken('jwt');
    expect(store.getToken()).toBe('jwt');
    expect(store.isAuthenticated()).toBe(true);
  });
  it('clears the token', () => {
    const store = createAuthStore();
    store.setToken('jwt');
    store.clear();
    expect(store.getToken()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });
});
