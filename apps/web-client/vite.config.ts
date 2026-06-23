import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Client-facing service URLs come from Vite env (VITE_*) with localhost
// fallbacks; plan 06 supplies the compose values at build time.
export default defineConfig({
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
});
