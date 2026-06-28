import { hash } from 'bcryptjs';
import { ok, err } from '@vss/shared';
import { buildHttpServer } from '../fastify-http';
import { createBcryptHasher } from '../bcrypt-hasher';
import type { UserRepository } from '../../ports/user-repository';
import type { TokenIssuer } from '../../ports/token-issuer';
import type { SessionStore } from '../../ports/session-store';
import type { IdGenerator } from '../../ports/id-generator';
import type { TokenVerifier } from '../../ports/token-verifier';
import type { AuditLog } from '../../ports/audit-log';
import type { CommandCipher } from '@vss/shared';
import type { LoginUserDeps } from '../../use-cases/login-user';

// ---------------------------------------------------------------------------
// Shared fakes used across most tests
// ---------------------------------------------------------------------------

const FIXED_TOKEN = 'fixed-jwt-token';
const GOOD_PASSWORD = 'correct-password';

/** Build a UserRepository that holds a single bcrypt-hashed user. */
async function buildUserRepo(login: string, plainPassword: string): Promise<UserRepository> {
  const passwordHash = await hash(plainPassword, 10);
  return {
    findByLogin: async (l) =>
      l === login ? { login, passwordHash, role: 'operator' } : null,
  };
}

const fakeIssuer: TokenIssuer = {
  issue: async () => FIXED_TOKEN,
};

const fakeSessionStore: SessionStore = {
  create: async () => undefined,
  isActive: async () => true,
  revoke: async () => undefined,
};

const fakeIds: IdGenerator = {
  next: () => 'jti-0001',
};

/** Verifier that accepts exactly the string 'good'. */
const fakeVerifier: TokenVerifier = {
  verify: async (t) =>
    t === 'good'
      ? ok({ sub: 'a', role: 'operator', jti: 'j', iat: 0, exp: 9999999999 })
      : err('bad'),
};

/** Minimal cipher — only getPublicKey is exercised by the routes under test. */
const fakeCipher = {
  getPublicKey: async () => 'PEM',
  encrypt: async (_plain: string) => '',
  decrypt: async (_cipher: string) => '',
} as unknown as CommandCipher;

/** No-op audit used by helpers that do not need to inspect audit entries. */
const noopAudit: AuditLog = { append: async () => undefined };

// ---------------------------------------------------------------------------
// Helper: build the server with working loginDeps for the happy-path tests
// ---------------------------------------------------------------------------

async function buildWithWorkingLoginDeps() {
  const users = await buildUserRepo('admin', GOOD_PASSWORD);
  const loginDeps: LoginUserDeps = {
    users,
    hasher: createBcryptHasher(),
    issuer: fakeIssuer,
    sessions: fakeSessionStore,
    ids: fakeIds,
    ttlSeconds: 3600,
  };
  return buildHttpServer({ loginDeps, verifier: fakeVerifier, cipher: fakeCipher, audit: noopAudit });
}

// ---------------------------------------------------------------------------
// Helper: build the server with loginDeps whose user password never matches
// ---------------------------------------------------------------------------

async function buildWithBadCredsLoginDeps() {
  // User exists but with a hash of a different password — compare will fail.
  const users = await buildUserRepo('admin', 'other-password');
  const loginDeps: LoginUserDeps = {
    users,
    hasher: createBcryptHasher(),
    issuer: fakeIssuer,
    sessions: fakeSessionStore,
    ids: fakeIds,
    ttlSeconds: 3600,
  };
  return buildHttpServer({ loginDeps, verifier: fakeVerifier, cipher: fakeCipher, audit: noopAudit });
}

// ---------------------------------------------------------------------------
// Helper: server built with a dummy loginDeps (body-validation tests only)
// ---------------------------------------------------------------------------

async function buildDefaultServer() {
  return buildWithWorkingLoginDeps();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildHttpServer — POST /auth/login', () => {
  it('returns 400 when the body is invalid (login is not a string)', async () => {
    const app = await buildDefaultServer();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { login: 1, password: 'pw' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const app = await buildDefaultServer();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 200 with a token on valid credentials', async () => {
    const app = await buildWithWorkingLoginDeps();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { login: 'admin', password: GOOD_PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ token: string }>().token).toBe(FIXED_TOKEN);
  });

  it('returns 401 when credentials are wrong', async () => {
    const app = await buildWithBadCredsLoginDeps();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { login: 'admin', password: 'bad-password' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('buildHttpServer — GET /protected', () => {
  it('returns 200 with sub and role when the Bearer token is valid', async () => {
    const app = await buildDefaultServer();
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer good' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ sub: string; role: string }>();
    expect(body.sub).toBe('a');
    expect(body.role).toBe('operator');
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const app = await buildDefaultServer();
    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when the token is invalid', async () => {
    const app = await buildDefaultServer();
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer invalid-token' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('buildHttpServer — GET /publicKey', () => {
  it('returns the cipher public key as plain text', async () => {
    const app = await buildDefaultServer();
    const res = await app.inject({ method: 'GET', url: '/publicKey' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('PEM');
  });
});

describe('buildHttpServer — audit log', () => {
  it('appends LOGIN ok=true on success and LOGIN ok=false on failure, never logging the password', async () => {
    const entries: Array<{ user: string; message: string }> = [];
    const audit: AuditLog = { append: async (user, message) => { entries.push({ user, message }); } };

    const users = await buildUserRepo('admin', GOOD_PASSWORD);
    const loginDeps: LoginUserDeps = {
      users,
      hasher: createBcryptHasher(),
      issuer: fakeIssuer,
      sessions: fakeSessionStore,
      ids: fakeIds,
      ttlSeconds: 3600,
    };
    const app = buildHttpServer({ loginDeps, verifier: fakeVerifier, cipher: fakeCipher, audit });

    await app.inject({ method: 'POST', url: '/auth/login', payload: { login: 'admin', password: GOOD_PASSWORD } });
    await app.inject({ method: 'POST', url: '/auth/login', payload: { login: 'admin', password: 'wrong-password' } });

    expect(entries).toContainEqual({ user: 'admin', message: 'LOGIN admin ok=true' });
    expect(entries).toContainEqual({ user: 'admin', message: 'LOGIN admin ok=false' });
    // Password must never appear in the audit log.
    expect(JSON.stringify(entries)).not.toContain(GOOD_PASSWORD);
    expect(JSON.stringify(entries)).not.toContain('wrong-password');
  });

  it('does not append an audit entry for malformed-body 400 responses (no identity present)', async () => {
    const entries: Array<{ user: string; message: string }> = [];
    const audit: AuditLog = { append: async (user, message) => { entries.push({ user, message }); } };

    const users = await buildUserRepo('admin', GOOD_PASSWORD);
    const loginDeps: LoginUserDeps = {
      users,
      hasher: createBcryptHasher(),
      issuer: fakeIssuer,
      sessions: fakeSessionStore,
      ids: fakeIds,
      ttlSeconds: 3600,
    };
    const app = buildHttpServer({ loginDeps, verifier: fakeVerifier, cipher: fakeCipher, audit });

    await app.inject({ method: 'POST', url: '/auth/login', payload: { login: 1, password: 'pw' } });

    expect(entries).toHaveLength(0);
  });
});
