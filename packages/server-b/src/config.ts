import { isAbsolute, resolve } from 'node:path';
import { z } from 'zod';

// config.ts is one directory below packages/server-b in both source layout
// (src/) and compiled layout (dist/), so three levels up reaches the repo root.
const REPO_ROOT = resolve(__dirname, '../../..');

/**
 * Resolves a `COMMANDS_LOG_PATH` value to an absolute path.
 *
 * - Absolute paths are returned as-is so that production deployments can
 *   supply a fully-qualified path without any rewriting.
 * - Relative paths are anchored to the repository root so that the resolved
 *   path is the same regardless of the process working directory.
 */
const resolveLogPath = (raw: string): string =>
  isAbsolute(raw) ? raw : resolve(REPO_ROOT, raw);

const numeric = z.string().regex(/^\d+$/, 'must be a positive integer').transform(Number);

const Schema = z.object({
  HTTP_PORT: numeric,
  CONTROL_WS_PORT: numeric,
  INTERSERVER_WS_PORT: numeric,
  PRIVATE_KEY_PATH: z.string().min(1),
  PUBLIC_KEY_PATH: z.string().min(1),
  USERS_PATH: z.string().min(1),
  COMMANDS_LOG_PATH: z.string().min(1),
  HMAC_SECRET: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_TTL_SECONDS: numeric,
  CIPHER_IMPL: z.enum(['node', 'native', 'tpm']).default('node'),
});

export interface ServerBConfig {
  readonly httpPort: number;
  readonly controlWsPort: number;
  readonly interServerWsPort: number;
  readonly privateKeyPath: string;
  readonly publicKeyPath: string;
  readonly usersPath: string;
  readonly commandsLogPath: string;
  readonly hmacSecret: string;
  readonly redisUrl: string;
  readonly jwtTtlSeconds: number;
  readonly cipherImpl: 'node' | 'native' | 'tpm';
}

export const loadServerBConfig = (env: Record<string, string | undefined>): ServerBConfig => {
  const parsed = Schema.parse(env);
  return {
    httpPort: parsed.HTTP_PORT,
    controlWsPort: parsed.CONTROL_WS_PORT,
    interServerWsPort: parsed.INTERSERVER_WS_PORT,
    privateKeyPath: parsed.PRIVATE_KEY_PATH,
    publicKeyPath: parsed.PUBLIC_KEY_PATH,
    usersPath: parsed.USERS_PATH,
    commandsLogPath: resolveLogPath(parsed.COMMANDS_LOG_PATH),
    hmacSecret: parsed.HMAC_SECRET,
    redisUrl: parsed.REDIS_URL,
    jwtTtlSeconds: parsed.JWT_TTL_SECONDS,
    cipherImpl: parsed.CIPHER_IMPL,
  };
};
