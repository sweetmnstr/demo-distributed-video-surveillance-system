import { generateKeyPairSync } from 'node:crypto';
import { createWindowsTpmDevice } from '../windows-tpm-device';
import type { TpmNativeAddon } from '../tpm-native';

const fakeAddon = (): { addon: TpmNativeAddon; calls: string[] } => {
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' }) as { n: string; e: string };
  const calls: string[] = [];
  const addon: TpmNativeAddon = {
    openOrCreateKey: async (name) => { calls.push(`open:${name}`); },
    getPublicKeyComponents: async () => ({
      modulus: Buffer.from(jwk.n, 'base64url'),
      exponent: Buffer.from(jwk.e, 'base64url'),
    }),
    decrypt: async (ct) => { calls.push(`decrypt:${ct.length}`); return Buffer.from('STOP_VIDEO'); },
  };
  return { addon, calls };
};

describe('createWindowsTpmDevice', () => {
  it('opens/creates the named key and exposes the TPM public key as PEM', async () => {
    const { addon, calls } = fakeAddon();
    const device = await createWindowsTpmDevice('vss-test-key', addon);
    expect(calls).toContain('open:vss-test-key');
    expect(await device.getPublicKey()).toContain('PUBLIC KEY');
  });

  it('delegates decrypt to the addon', async () => {
    const { addon } = fakeAddon();
    const device = await createWindowsTpmDevice('vss-test-key', addon);
    expect((await device.decrypt(Buffer.alloc(256))).toString('utf8')).toBe('STOP_VIDEO');
  });

  it('refuses to export the private key (non-exportable invariant)', async () => {
    const { addon } = fakeAddon();
    const device = await createWindowsTpmDevice('vss-test-key', addon);
    expect(() => device.exportPrivateKey()).toThrow(/cannot be exported/);
  });

  it('surfaces a friendly error when the addon cannot be loaded', async () => {
    const failing: TpmNativeAddon = {
      openOrCreateKey: async () => { throw new Error('NTE_DEVICE_NOT_READY'); },
      getPublicKeyComponents: async () => { throw new Error('unused'); },
      decrypt: async () => { throw new Error('unused'); },
    };
    await expect(createWindowsTpmDevice('vss-test-key', failing)).rejects.toThrow(/TPM/i);
  });

  it('wraps a non-Error thrown value as "unknown error"', async () => {
    const addon: TpmNativeAddon = {
      openOrCreateKey: async () => { throw 'not an Error'; },
      getPublicKeyComponents: async () => { throw new Error('unused'); },
      decrypt: async () => { throw new Error('unused'); },
    };
    await expect(createWindowsTpmDevice('vss-test-key', addon)).rejects.toThrow(/unknown error/);
  });

  it('extracts message from a cross-realm error-like object (not instanceof Error)', async () => {
    // Native addon rejections inside a Jest sandbox may not satisfy `instanceof Error`
    // because the V8 global Error from the addon's realm differs from Jest's sandboxed Error.
    // The extractDetail helper must still recover the message string.
    const crossRealmLike = Object.assign(Object.create(null) as object, {
      message: 'NCryptOpenStorageProvider failed: status -2146893776',
    });
    const addon: TpmNativeAddon = {
      openOrCreateKey: async () => { throw crossRealmLike; },
      getPublicKeyComponents: async () => { throw new Error('unused'); },
      decrypt: async () => { throw new Error('unused'); },
    };
    await expect(createWindowsTpmDevice('vss-test-key', addon)).rejects.toThrow(
      'NCryptOpenStorageProvider failed: status -2146893776',
    );
  });
});
