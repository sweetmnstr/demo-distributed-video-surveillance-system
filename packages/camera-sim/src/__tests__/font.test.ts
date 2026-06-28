import { resolve } from 'node:path';
import { resolveFontPath } from '../font';

// The bundled font is resolved from font.ts (__dirname = src/), one level up to assets/.
// From this test file (__dirname = src/__tests__/), two levels up reaches the same assets/.
const BUNDLED_PATH = resolve(__dirname, '../../assets/DejaVuSans.ttf');

describe('resolveFontPath', () => {
  const exists = (present: string[]) => (p: string) => present.includes(p);

  it('prefers the env override when it exists', () => {
    const got = resolveFontPath({
      env: '/fonts/env.ttf', bundled: '/fonts/bundled.ttf', fallback: '/fonts/sys.ttf',
      exists: exists(['/fonts/env.ttf', '/fonts/bundled.ttf']),
    });
    expect(got).toBe('/fonts/env.ttf');
  });

  it('falls back to bundled when env is unset or missing', () => {
    const got = resolveFontPath({
      bundled: '/fonts/bundled.ttf', fallback: '/fonts/sys.ttf',
      exists: exists(['/fonts/bundled.ttf']),
    });
    expect(got).toBe('/fonts/bundled.ttf');
  });

  it('falls back to the system font when neither env nor bundled exist', () => {
    const got = resolveFontPath({
      bundled: '/fonts/bundled.ttf', fallback: '/fonts/sys.ttf',
      exists: exists([]),
    });
    expect(got).toBe('/fonts/sys.ttf');
  });

  it('ignores env when it is defined but does not exist, falling through to bundled', () => {
    const got = resolveFontPath({
      env: '/fonts/missing.ttf', bundled: '/fonts/bundled.ttf', fallback: '/fonts/sys.ttf',
      exists: exists(['/fonts/bundled.ttf']),
    });
    expect(got).toBe('/fonts/bundled.ttf');
  });

  it('uses default exists/bundled/fallback when called with no options', () => {
    // The bundled DejaVuSans.ttf is now shipped at packages/camera-sim/assets/.
    // resolveFontPath() with no arguments uses real existsSync and resolves to
    // the bundled font instead of the Windows Arial system fallback.
    const got = resolveFontPath();
    expect(got).toBe(BUNDLED_PATH);
  });
});
