import { readFile } from 'node:fs/promises';
import { WebSocketServer } from 'ws';
import type { CommandCipher } from '@vss/shared';
import { loadNativeAddon, createNativeCryptoCipher } from '@vss/native-crypto';
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
import { createSoftwareTpmDevice, createTpmCipher } from '@vss/tpm-crypto';

const buildCipher = async (cfg: { cipherImpl: 'node' | 'native' | 'tpm'; privateKeyPath: string; publicKeyPath: string }): Promise<CommandCipher> => {
  if (cfg.cipherImpl === 'node') {
    const privatePem = await readFile(cfg.privateKeyPath, 'utf8');
    const publicPem = await readFile(cfg.publicKeyPath, 'utf8');
    return createNodeCryptoCipher(privatePem, publicPem);
  }
  if (cfg.cipherImpl === 'native') {
    const addon = loadNativeAddon();
    await addon.generateKeyPair();
    return createNativeCryptoCipher(addon);
  }
  if (cfg.cipherImpl === 'tpm') {
    return createTpmCipher(createSoftwareTpmDevice());
  }
  throw new Error(`cipher implementation '${cfg.cipherImpl}' is not available`);
};

const main = async (): Promise<void> => {
  const cfg = loadServerBConfig(process.env);

  const users = await createJsonUserRepo(cfg.usersPath);
  const hasher = createBcryptHasher();
  const issuer = await createJoseTokenIssuer(cfg.privateKeyPath, cfg.jwtTtlSeconds);
  const verifier = await createJoseTokenVerifier(cfg.publicKeyPath);
  const sessions = createRedisSessionStore(cfg.redisUrl);
  const audit = createHmacAuditLog(cfg.commandsLogPath, cfg.hmacSecret);
  const ids = createUuidIdGenerator();

  const interServerWss = new WebSocketServer({ port: cfg.interServerWsPort });
  const forwarder = createWsCommandForwarder({ wss: interServerWss });

  const cipher = await buildCipher(cfg);

  const http = buildHttpServer({
    loginDeps: { users, hasher, issuer, sessions, ids, ttlSeconds: cfg.jwtTtlSeconds },
    verifier,
    cipher,
  });
  await http.listen({ port: cfg.httpPort, host: '0.0.0.0' });

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
