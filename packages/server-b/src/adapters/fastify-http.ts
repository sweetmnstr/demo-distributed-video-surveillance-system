import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { CommandCipher, LoginRequest, createLogger } from '@vss/shared';
import { loginUser, LoginUserDeps } from '../use-cases/login-user';
import { TokenVerifier } from '../ports/token-verifier';

const log = createLogger('server-b');

export interface HttpDeps {
  readonly loginDeps: LoginUserDeps;
  readonly verifier: TokenVerifier;
  readonly cipher: CommandCipher;
}

export const buildHttpServer = (deps: HttpDeps): FastifyInstance => {
  const app = Fastify({ logger: false });
  app.register(cors, { origin: true, methods: ['GET', 'POST', 'OPTIONS'] });

  app.post('/auth/login', async (request, reply) => {
    const body = LoginRequest.safeParse(request.body);
    if (!body.success) {
      log.warn('login rejected: malformed request body');
      return reply.code(400).send({ error: 'invalid request' });
    }
    const result = await loginUser(body.data, deps.loginDeps);
    if (result.kind === 'err') {
      log.warn(`login failed for "${body.data.login}": ${result.error}`);
      return reply.code(401).send({ error: result.error });
    }
    log.info(`login succeeded for "${body.data.login}"`);
    return reply.send({ token: result.value.token });
  });

  // JWT signature and expiry are verified here. Session revocation (Redis isActive)
  // is intentionally not checked on this endpoint — it is a lightweight public-key
  // verification gate. Revocation is enforced at WebSocket auth time via authenticateConnection.
  app.get('/protected', async (request, reply) => {
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const verified = await deps.verifier.verify(token);
    if (verified.kind === 'err') return reply.code(401).send({ error: 'unauthorized' });
    return reply.send({ sub: verified.value.sub, role: verified.value.role });
  });

  app.get('/publicKey', async (_request, reply) => reply.type('text/plain').send(await deps.cipher.getPublicKey()));

  return app;
};
