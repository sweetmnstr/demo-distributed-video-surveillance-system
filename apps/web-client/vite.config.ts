import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Client-facing service URLs come from Vite env (VITE_*) with localhost
// fallbacks; plan 06 supplies the compose values at build time.
// The `define` block exposes VITE_* vars via process.env so that env.ts can
// read them uniformly in both the browser bundle (via define replacement) and
// in ts-jest/Node (via the real process.env object).
export default defineConfig(({ mode }) => {
  const viteEnv = loadEnv(mode, process.cwd(), 'VITE_');
  const processEnvDefines = Object.fromEntries(
    Object.entries(viteEnv).map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)]),
  );
  return {
    define: processEnvDefines,
    plugins: [react()],
    server: { port: 5173 },
    build: {
      outDir: 'dist',
      rollupOptions: {
        // @vss/shared re-exports hmac-log which uses node: built-ins; mark them
        // external so Rollup skips them — the web client never calls hmac-log.
        external: [/^node:/],
      },
    },
  };
});
