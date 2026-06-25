import { generateKeyPair, exportPKCS8, exportSPKI } from 'jose';
import { signAccessToken } from '@vss/shared';
import { createJoseTokenVerifier } from '../jose-token-verifier';
import { isOk, isErr } from '@vss/shared';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

// Build ephemeral RS256 key pair and export as PEM strings.
const buildKeys = async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  return {
    privatePem: await exportPKCS8(privateKey),
    publicPem: await exportSPKI(publicKey),
  };
};

describe('createJoseTokenVerifier (server-a)', () => {
  it('verifies a valid RS256 token and returns ok with correct claims', async () => {
    const { privatePem, publicPem } = await buildKeys();

    // Write the public key to a temp file so createJoseTokenVerifier can read it
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vss-test-'));
    const pubKeyPath = path.join(tmpDir, 'public.pem');
    await fs.writeFile(pubKeyPath, publicPem, 'utf8');

    const verifier = await createJoseTokenVerifier(pubKeyPath);
    const token = await signAccessToken(
      { sub: 'user1', role: 'viewer', jti: 'jti-a1' },
      privatePem,
      3600,
    );

    const result = await verifier.verify(token);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.sub).toBe('user1');
      expect(result.value.role).toBe('viewer');
      expect(result.value.jti).toBe('jti-a1');
    }

    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns err for a malformed token', async () => {
    const { publicPem } = await buildKeys();

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vss-test-'));
    const pubKeyPath = path.join(tmpDir, 'public.pem');
    await fs.writeFile(pubKeyPath, publicPem, 'utf8');

    const verifier = await createJoseTokenVerifier(pubKeyPath);
    const result = await verifier.verify('not.a.valid.jwt.token');

    expect(isErr(result)).toBe(true);

    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns err for a token signed with a different key', async () => {
    const { privatePem } = await buildKeys();
    const { publicPem: differentPublicPem } = await buildKeys();

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vss-test-'));
    const pubKeyPath = path.join(tmpDir, 'public.pem');
    await fs.writeFile(pubKeyPath, differentPublicPem, 'utf8');

    const verifier = await createJoseTokenVerifier(pubKeyPath);
    const token = await signAccessToken(
      { sub: 'user2', role: 'operator', jti: 'jti-a2' },
      privatePem,
      3600,
    );

    const result = await verifier.verify(token);

    expect(isErr(result)).toBe(true);

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
