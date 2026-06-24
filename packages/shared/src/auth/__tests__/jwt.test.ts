import { generateKeyPair, exportPKCS8, exportSPKI, SignJWT, importPKCS8 } from 'jose';
import { signAccessToken, verifyAccessToken } from '../jwt';
import { isErr, isOk } from '../../result/result';

const buildKeys = async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  return { privatePem: await exportPKCS8(privateKey), publicPem: await exportSPKI(publicKey) };
};

describe('JWT RS256', () => {
  it('signs with private key, verifies with public key', async () => {
    const { privatePem, publicPem } = await buildKeys();
    const token = await signAccessToken({ sub: 'admin', role: 'operator', jti: 'jti-1' }, privatePem, 3600);
    const result = await verifyAccessToken(token, publicPem);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.sub).toBe('admin');
      expect(result.value.role).toBe('operator');
      expect(result.value.jti).toBe('jti-1');
    }
  });

  it('returns err for an invalid token', async () => {
    const { publicPem } = await buildKeys();
    expect(isErr(await verifyAccessToken('not.a.jwt', publicPem))).toBe(true);
  });

  it('returns err for an expired token', async () => {
    const { privatePem, publicPem } = await buildKeys();
    const token = await signAccessToken({ sub: 'admin', role: 'operator', jti: 'jti-2' }, privatePem, -1);
    expect(isErr(await verifyAccessToken(token, publicPem))).toBe(true);
  });

  it('returns err with fallback message when error is not an Error instance', async () => {
    const { publicPem } = await buildKeys();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.spyOn(require('jose'), 'jwtVerify').mockRejectedValueOnce('string error');
    expect(isErr(await verifyAccessToken('x.y.z', publicPem))).toBe(true);
    jest.restoreAllMocks();
  });

  it('returns err for a token missing required claims (sub/jti absent)', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const privatePem = await exportPKCS8(privateKey);
    const publicPem = await exportSPKI(publicKey);
    const keyObj = await importPKCS8(privatePem, 'RS256');
    // Sign a token with only role — no sub, no jti
    const token = await new SignJWT({ role: 'operator' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(keyObj);
    const result = await verifyAccessToken(token, publicPem);
    expect(isErr(result)).toBe(true);
  });

  it('returns err for a token with an invalid role', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const privatePem = await exportPKCS8(privateKey);
    const publicPem = await exportSPKI(publicKey);
    const keyObj = await importPKCS8(privatePem, 'RS256');
    const token = await new SignJWT({ role: 'superadmin' })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('admin')
      .setJti('jti-99')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(keyObj);
    const result = await verifyAccessToken(token, publicPem);
    expect(isErr(result)).toBe(true);
  });
});
