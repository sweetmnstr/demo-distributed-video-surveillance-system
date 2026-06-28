import { readFile } from 'node:fs/promises';
import { type CommandCipher } from '@vss/shared';
import { loadNativeAddon, createNativeCryptoCipher } from '@vss/native-crypto';
import {
  createSoftwareTpmDevice,
  createWindowsTpmDevice,
  createTpmCipher,
} from '@vss/tpm-crypto';
import { createNodeCryptoCipher } from './node-cipher';

export interface BuildCipherConfig {
  readonly cipherImpl: 'node' | 'native' | 'tpm';
  readonly privateKeyPath: string;
  readonly publicKeyPath: string;
  readonly tpmKeyName: string;
}

export interface BuildCipherDeps {
  readonly platform?: NodeJS.Platform;
  readonly log?: { warn?: (m: string) => void; info?: (m: string) => void };
  readonly createWindowsDevice?: typeof createWindowsTpmDevice;
}

// Selects the TPM device by platform: the real Windows CNG/PCP device on win32,
// otherwise (or if the hardware device fails) the software-emulated sealed key.
const buildTpmCipher = async (
  cfg: BuildCipherConfig,
  deps: BuildCipherDeps,
): Promise<CommandCipher> => {
  const platform = deps.platform ?? process.platform;
  const createWindows = deps.createWindowsDevice ?? createWindowsTpmDevice;
  if (platform === 'win32') {
    try {
      const cipher = createTpmCipher(await createWindows(cfg.tpmKeyName));
      deps.log?.info?.('cipher: using Windows TPM (PCP/CNG) device');
      return cipher;
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : 'unknown error';
      deps.log?.warn?.(
        `cipher: Windows TPM unavailable (${detail}); falling back to software TPM device`,
      );
    }
  } else {
    deps.log?.info?.('cipher: non-Windows platform; using software TPM device');
  }
  return createTpmCipher(createSoftwareTpmDevice());
};

// Builds the CommandCipher for the configured implementation. Keeps transport
// and key-management concerns out of main.ts and stays unit-testable via the
// injection seams in BuildCipherDeps.
export const buildCipher = async (
  cfg: BuildCipherConfig,
  deps: BuildCipherDeps = {},
): Promise<CommandCipher> => {
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
    return buildTpmCipher(cfg, deps);
  }
  throw new Error(`cipher implementation '${cfg.cipherImpl}' is not available`);
};
