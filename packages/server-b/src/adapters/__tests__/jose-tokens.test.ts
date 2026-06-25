import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { createJoseTokenIssuer } from '../jose-token-issuer';
import { createJoseTokenVerifier } from '../jose-token-verifier';

/** Generates an ephemeral RS256 key pair and writes PEM files to a temp dir. */
const makeKeyFiles = async (): Promise<{ priv: string; pub: string }> => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const dir = await mkdtemp(join(tmpdir(), 'vss-keys-'));
  const priv = join(dir, 'private.pem');
  const pub = join(dir, 'public.pem');
  await writeFile(priv, privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
  await writeFile(pub, publicKey.export({ type: 'spki', format: 'pem' }).toString());
  return { priv, pub };
};

describe('JoseTokenIssuer / JoseTokenVerifier', () => {
  it('issues a token that the verifier accepts with the correct claims', async () => {
    const { priv, pub } = await makeKeyFiles();
    const issuer = await createJoseTokenIssuer(priv, 3600);
    const verifier = await createJoseTokenVerifier(pub);

    const token = await issuer.issue({ sub: 'alice', role: 'operator', jti: 'jti-round-trip' });
    const result = await verifier.verify(token);

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.sub).toBe('alice');
      expect(result.value.role).toBe('operator');
      expect(result.value.jti).toBe('jti-round-trip');
    }
  });

  it('rejects a malformed (non-JWT) string', async () => {
    const { pub } = await makeKeyFiles();
    const verifier = await createJoseTokenVerifier(pub);

    const result = await verifier.verify('not.a.real.jwt');

    expect(result.kind).toBe('err');
  });

  it('rejects a token signed by a different key', async () => {
    const { priv } = await makeKeyFiles();
    const { pub: otherPub } = await makeKeyFiles();

    const issuer = await createJoseTokenIssuer(priv, 3600);
    const verifier = await createJoseTokenVerifier(otherPub);

    const token = await issuer.issue({ sub: 'bob', role: 'viewer', jti: 'jti-wrong-key' });
    const result = await verifier.verify(token);

    expect(result.kind).toBe('err');
  });

  it('rejects an already-expired token (ttlSeconds = -1)', async () => {
    const { priv, pub } = await makeKeyFiles();
    // ttlSeconds = -1 sets exp = Math.floor(Date.now()/1000) - 1, which is in the past.
    // jose's jwtVerify will reject it, and verifyAccessToken catches the error returning err().
    const issuer = await createJoseTokenIssuer(priv, -1);
    const verifier = await createJoseTokenVerifier(pub);

    const token = await issuer.issue({ sub: 'carol', role: 'viewer', jti: 'jti-expired' });
    const result = await verifier.verify(token);

    expect(result.kind).toBe('err');
  });
});
