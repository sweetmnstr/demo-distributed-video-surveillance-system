import { readFileSync } from 'node:fs';
import { WebSocketServer } from 'ws';
import type { CommandCipher } from '@vss/shared';
import { loadServerBConfig } from './config';
import { createJsonUserRepo } from './adapters/json-user-repo';
import { createBcryptHasher } from './adapters/bcrypt-hasher';
import { createJoseTokenIssuer } from './adapters/jose-token-issuer';
import { createJoseTokenVerifier } from './adapters/jose-token-verifier';
import { createRedisSessionStore } from './adapters/redis-session-store';
import { createHmacAuditLog } from './adapters/hmac-audit-log';
import { createUuidIdGenerator } from './adapters/uuid-id-generator';
import { createWsCommandForwarder } from './adapters/ws-command-forwarder';
import { buildHttpServer } from './adapters/fastify-http';
import { startControlServer } from './adapters/ws-control-server';
import { createNodeCryptoCipher } from './crypto/node-cipher';

const buildCipher = (cfg: { cipherImpl: 'node' | 'native' | 'tpm'; privateKeyPath: string; publicKeyPath: string }): CommandCipher => {
  const privatePem = readFileSync(cfg.privateKeyPath, 'utf8');
  const publicPem = readFileSync(cfg.publicKeyPath, 'utf8');
  if (cfg.cipherImpl === 'node') return createNodeCryptoCipher(privatePem, publicPem);
  // 'native' (plan 08) and 'tpm' (plan 09) are wired in later bonus plans.
  throw new Error(`cipher implementation '${cfg.cipherImpl}' is not available yet`);
};

const main = async (): Promise<void> => {
  const cfg = loadServerBConfig(process.env);

  const users = createJsonUserRepo(cfg.usersPath);
  const hasher = createBcryptHasher();
  const issuer = createJoseTokenIssuer(cfg.privateKeyPath, cfg.jwtTtlSeconds);
  const verifier = createJoseTokenVerifier(cfg.publicKeyPath);
  const sessions = createRedisSessionStore(cfg.redisUrl);
  const audit = createHmacAuditLog(cfg.commandsLogPath, cfg.hmacSecret);
  const ids = createUuidIdGenerator();

  const interServerWss = new WebSocketServer({ port: cfg.interServerWsPort });
  const forwarder = createWsCommandForwarder({ wss: interServerWss });

  const http = buildHttpServer({
    loginDeps: { users, hasher, issuer, sessions, ids, ttlSeconds: cfg.jwtTtlSeconds },
    verifier,
    publicKeyPath: cfg.publicKeyPath,
  });
  await http.listen({ port: cfg.httpPort, host: '0.0.0.0' });

  const controlWss = new WebSocketServer({ port: cfg.controlWsPort });
  startControlServer({
    wss: controlWss,
    auth: { verifier, sessions },
    process: { audit, forwarder },
    logoutDeps: { sessions, audit },
    cipher: buildCipher(cfg),
  });
};

main().catch((err: unknown) => {
  console.error('Fatal startup error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
