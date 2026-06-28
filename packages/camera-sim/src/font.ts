import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Default Windows system font, guaranteed present on the target platform.
// Kept as a RAW path; filtergraph escaping is centralized in ffmpeg-args.ts.
const WINDOWS_ARIAL = 'C:/Windows/Fonts/arial.ttf';
// Bundled DejaVuSans.ttf, shipped at packages/camera-sim/assets/. Resolves
// correctly from both src/ (ts-jest) and dist/ (compiled), since both are one
// level below the assets/ directory.
const BUNDLED = resolve(__dirname, '../assets/DejaVuSans.ttf');

export interface FontResolveOptions {
  readonly env?: string;
  readonly bundled?: string;
  readonly fallback?: string;
  readonly exists?: (path: string) => boolean;
}

// Resolves the overlay font with precedence env -> bundled -> system fallback.
// Returns the fallback even if it does not exist so ffmpeg surfaces a clear error.
export const resolveFontPath = (opts: FontResolveOptions = {}): string => {
  const exists = opts.exists ?? existsSync;
  const bundled = opts.bundled ?? BUNDLED;
  const fallback = opts.fallback ?? WINDOWS_ARIAL;
  if (opts.env && exists(opts.env)) return opts.env;
  if (exists(bundled)) return bundled;
  return fallback;
};
