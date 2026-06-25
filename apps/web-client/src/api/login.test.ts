// Unit tests for api/login.ts
// Mocks: globalThis.fetch, ../lib/env (module-level env access)

jest.mock('../lib/env', () => ({
  env: { serverBHttp: 'http://test-server', serverBWs: 'ws://test', serverAWs: 'ws://test-a' },
}));

import { login } from './login';

describe('login', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns the JWT token on a 200 OK response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'test-jwt-token' }),
    }) as never;

    const token = await login('admin', 'secret');

    expect(token).toBe('test-jwt-token');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://test-server/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login: 'admin', password: 'secret' }),
      }),
    );
  });

  it('throws a friendly error on a non-200 response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false }) as never;

    await expect(login('admin', 'wrong-password')).rejects.toThrow(
      'invalid login or password',
    );
  });
});
