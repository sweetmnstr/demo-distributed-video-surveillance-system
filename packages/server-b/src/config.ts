import { z } from 'zod';

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
    commandsLogPath: parsed.COMMANDS_LOG_PATH,
    hmacSecret: parsed.HMAC_SECRET,
    redisUrl: parsed.REDIS_URL,
    jwtTtlSeconds: parsed.JWT_TTL_SECONDS,
    cipherImpl: parsed.CIPHER_IMPL,
  };
};
