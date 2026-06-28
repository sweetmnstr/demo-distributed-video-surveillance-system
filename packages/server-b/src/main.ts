import { WebSocketServer } from 'ws';
import { createLogger } from '@vss/shared';
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
import { buildCipher } from './crypto/build-cipher';

const log = createLogger('server-b');

const main = async (): Promise<void> => {
  const cfg = loadServerBConfig(process.env);

  const users = await createJsonUserRepo(cfg.usersPath);
  const hasher = createBcryptHasher();
  const issuer = await createJoseTokenIssuer(cfg.privateKeyPath, cfg.jwtTtlSeconds);
  const verifier = await createJoseTokenVerifier(cfg.publicKeyPath);
  const sessions = createRedisSessionStore(cfg.redisUrl);
  const audit = createHmacAuditLog(cfg.commandsLogPath, cfg.hmacSecret, log);
  const ids = createUuidIdGenerator();

  const interServerWss = new WebSocketServer({ port: cfg.interServerWsPort });
  const forwarder = createWsCommandForwarder({ wss: interServerWss });

  const cipher = await buildCipher(
    {
      cipherImpl: cfg.cipherImpl,
      privateKeyPath: cfg.privateKeyPath,
      publicKeyPath: cfg.publicKeyPath,
      tpmKeyName: cfg.tpmKeyName,
    },
    { log },
  );

  const http = buildHttpServer({
    loginDeps: { users, hasher, issuer, sessions, ids, ttlSeconds: cfg.jwtTtlSeconds },
    verifier,
    cipher,
    audit,
  });
  await http.listen({ port: cfg.httpPort, host: '0.0.0.0' });
  log.info(`HTTP on :${cfg.httpPort}, inter-server WS on :${cfg.interServerWsPort}, control WS on :${cfg.controlWsPort} (cipher=${cfg.cipherImpl})`);

  const controlWss = new WebSocketServer({ port: cfg.controlWsPort });
  startControlServer({
    wss: controlWss,
    auth: { verifier, sessions },
    process: { audit, forwarder },
    logoutDeps: { sessions, audit },
    cipher,
  });
};

main().catch((err: unknown) => {
  console.error('Fatal startup error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
