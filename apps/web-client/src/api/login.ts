import { env } from '../lib/env';

const BASE = env.serverBHttp;

// Posts credentials to Server B and returns the JWT, or throws a friendly error.
export const login = async (loginName: string, password: string): Promise<string> => {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login: loginName, password }),
  });
  if (!res.ok) throw new Error('invalid login or password');
  const body = (await res.json()) as { token: string };
  return body.token;
};
