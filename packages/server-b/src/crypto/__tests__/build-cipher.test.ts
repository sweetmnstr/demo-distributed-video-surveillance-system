import { generateKeyPairSync } from 'node:crypto';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildCipher, type BuildCipherDeps } from '../build-cipher';

// Mock @vss/tpm-crypto so no real hardware is touched during unit tests.
// createWindowsTpmDevice always fails; createSoftwareTpmDevice returns a fake
// sealed key; createTpmCipher wraps any TpmDevice into a CommandCipher.
jest.mock('@vss/tpm-crypto', () => ({
  createWindowsTpmDevice: jest.fn().mockRejectedValue(new Error('NTE_DEVICE_NOT_READY')),
  createSoftwareTpmDevice: jest.fn().mockReturnValue({
    getPublicKey: jest
      .fn()
      .mockResolvedValue('-----BEGIN PUBLIC KEY-----\nSOFTWARE\n-----END PUBLIC KEY-----'),
    decrypt: jest.fn().mockResolvedValue(Buffer.from('DECRYPTED')),
    exportPrivateKey: jest.fn(() => {
      throw new Error('cannot be exported');
    }),
  }),
  createTpmCipher: jest.fn(
    (device: { getPublicKey: () => Promise<string>; decrypt: (ct: Buffer) => Promise<Buffer> }) => ({
      getPublicKey: () => device.getPublicKey(),
      decrypt: async (ct: Buffer) => (await device.decrypt(ct)).toString('utf8'),
    }),
  ),
}));

// Mock @vss/native-crypto to avoid loading the real native addon in unit tests.
jest.mock('@vss/native-crypto', () => ({
  loadNativeAddon: jest.fn().mockReturnValue({
    generateKeyPair: jest.fn().mockResolvedValue(undefined),
    getPublicKey: jest
      .fn()
      .mockResolvedValue('-----BEGIN PUBLIC KEY-----\nNATIVE\n-----END PUBLIC KEY-----'),
    decryptWithPrivateKey: jest.fn().mockResolvedValue(Buffer.from('NATIVE_DECRYPTED')),
  }),
  createNativeCryptoCipher: jest.fn(
    (addon: {
      getPublicKey: () => Promise<string>;
      decryptWithPrivateKey: (ct: Buffer) => Promise<Buffer>;
    }) => ({
      getPublicKey: () => addon.getPublicKey(),
      decrypt: async (ct: Buffer) => (await addon.decryptWithPrivateKey(ct)).toString('utf8'),
    }),
  ),
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** Config for the tpm branch; irrelevant fields point to dummy paths. */
const tpmCfg = {
  cipherImpl: 'tpm' as const,
  privateKeyPath: 'k.pem',
  publicKeyPath: 'p.pem',
  tpmKeyName: 'vss-tpm-command-key',
};

/**
 * An injectable fake Windows device that always succeeds. The function
 * signature matches `typeof createWindowsTpmDevice`.
 */
const fakeDevice: BuildCipherDeps['createWindowsDevice'] = jest.fn(async () => ({
  getPublicKey: async () => '-----BEGIN PUBLIC KEY-----\nFAKE\n-----END PUBLIC KEY-----',
  decrypt: async () => Buffer.from('STOP_VIDEO'),
  exportPrivateKey: () => {
    throw new Error('cannot be exported');
  },
}));

// Temporary directory that holds real PEM files for the node branch test.
let tmpDir: string;
let privatePath: string;
let publicPath: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'build-cipher-test-'));
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  privatePath = join(tmpDir, 'private.pem');
  publicPath = join(tmpDir, 'public.pem');
  await writeFile(privatePath, privatePem);
  await writeFile(publicPath, publicPem);
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// node branch
// ---------------------------------------------------------------------------

describe('buildCipher — node branch', () => {
  it('reads PEM files from disk and returns a working NodeCryptoCipher', async () => {
    const cipher = await buildCipher({
      cipherImpl: 'node',
      privateKeyPath: privatePath,
      publicKeyPath: publicPath,
      tpmKeyName: 'unused',
    });
    expect(await cipher.getPublicKey()).toContain('PUBLIC KEY');
  });
});

// ---------------------------------------------------------------------------
// native branch
// ---------------------------------------------------------------------------

describe('buildCipher — native branch', () => {
  it('loads the native addon, generates a key pair, and wraps it as a CommandCipher', async () => {
    const cipher = await buildCipher({
      cipherImpl: 'native',
      privateKeyPath: 'irrelevant.pem',
      publicKeyPath: 'irrelevant.pem',
      tpmKeyName: 'unused',
    });
    expect(await cipher.getPublicKey()).toContain('PUBLIC KEY');
  });
});

// ---------------------------------------------------------------------------
// tpm branch
// ---------------------------------------------------------------------------

describe('buildCipher — TPM branch', () => {
  it('uses the Windows TPM device on win32 and does not warn', async () => {
    const warn = jest.fn();
    const createWindowsDevice = jest.fn(fakeDevice);
    await buildCipher(tpmCfg, {
      platform: 'win32',
      log: { warn, info: jest.fn() },
      createWindowsDevice,
    });
    expect(createWindowsDevice).toHaveBeenCalledWith('vss-tpm-command-key');
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back to software (with a warning) when the TPM device fails on win32', async () => {
    const warn = jest.fn();
    const createWindowsDevice = jest.fn(async () => {
      throw new Error('NTE_DEVICE_NOT_READY');
    });
    const cipher = await buildCipher(tpmCfg, {
      platform: 'win32',
      log: { warn, info: jest.fn() },
      createWindowsDevice,
    });
    expect(warn).toHaveBeenCalled();
    expect(await cipher.getPublicKey()).toContain('PUBLIC KEY');
  });

  it('uses "unknown error" in the warning when a non-Error is thrown on win32', async () => {
    const warn = jest.fn();
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    const createWindowsDevice = jest.fn(async () => Promise.reject('string-error'));
    await buildCipher(tpmCfg, { platform: 'win32', log: { warn, info: jest.fn() }, createWindowsDevice });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown error'));
  });

  it('uses the software device directly on non-win32 without calling createWindowsDevice', async () => {
    const createWindowsDevice = jest.fn(fakeDevice);
    const cipher = await buildCipher(tpmCfg, {
      platform: 'linux',
      log: { warn: jest.fn(), info: jest.fn() },
      createWindowsDevice,
    });
    expect(createWindowsDevice).not.toHaveBeenCalled();
    expect(await cipher.getPublicKey()).toContain('PUBLIC KEY');
  });

  it('defaults to process.platform when the platform dep is not injected', async () => {
    // process.platform is 'win32' on this machine; the mocked createWindowsTpmDevice
    // always throws, so the code falls through to the software TPM fallback.
    const cipher = await buildCipher(tpmCfg, { log: { warn: jest.fn(), info: jest.fn() } });
    expect(await cipher.getPublicKey()).toContain('PUBLIC KEY');
  });

  it('uses the module-level createWindowsTpmDevice when createWindowsDevice is not injected', async () => {
    // No createWindowsDevice in deps → build-cipher imports createWindowsTpmDevice from
    // @vss/tpm-crypto, which is mocked to always throw → software fallback.
    const cipher = await buildCipher(tpmCfg, {
      platform: 'win32',
      log: { warn: jest.fn(), info: jest.fn() },
    });
    expect(await cipher.getPublicKey()).toContain('PUBLIC KEY');
  });

  it('runs silently when no log dep is provided (covers log?. undefined paths)', async () => {
    // win32 success path — log?.info?.() short-circuits (log undefined)
    const cwd = jest.fn(fakeDevice);
    await expect(buildCipher(tpmCfg, { platform: 'win32', createWindowsDevice: cwd })).resolves.toBeDefined();
    // win32 failure path — log?.warn?.() short-circuits (log undefined)
    const cwdFail = jest.fn(async () => { throw new Error('fail'); });
    await expect(buildCipher(tpmCfg, { platform: 'win32', createWindowsDevice: cwdFail })).resolves.toBeDefined();
    // non-win32 path — log?.info?.() short-circuits (log undefined)
    await expect(buildCipher(tpmCfg, { platform: 'linux' })).resolves.toBeDefined();
  });

  it('runs silently when log.info and log.warn are not provided (covers ?.() undefined paths)', async () => {
    // win32 success — log is defined, info is undefined → inner ?.() short-circuits
    const cwd = jest.fn(fakeDevice);
    await expect(
      buildCipher(tpmCfg, { platform: 'win32', log: {}, createWindowsDevice: cwd }),
    ).resolves.toBeDefined();
    // win32 failure — log is defined, warn is undefined → inner ?.() short-circuits
    const cwdFail = jest.fn(async () => { throw new Error('fail'); });
    await expect(
      buildCipher(tpmCfg, { platform: 'win32', log: {}, createWindowsDevice: cwdFail }),
    ).resolves.toBeDefined();
    // non-win32 — log is defined, info is undefined → inner ?.() short-circuits
    await expect(buildCipher(tpmCfg, { platform: 'linux', log: {} })).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// unknown implementation
// ---------------------------------------------------------------------------

describe('buildCipher — unknown implementation', () => {
  it('throws for an unrecognized cipherImpl', async () => {
    // Cast needed to exercise the unreachable throw at runtime.
    const badCfg = { ...tpmCfg, cipherImpl: 'invalid' as unknown as 'node' };
    await expect(buildCipher(badCfg)).rejects.toThrow(/not available/);
  });
});
