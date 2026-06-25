// Shims for Node.js globals missing from jest-environment-jsdom.
// jose and other crypto libraries require TextEncoder/TextDecoder at load time.
// This file runs via `setupFiles` — before any test module is imported.
// Using a plain .js file avoids needing @types/node in the web-client tsconfig.
const { TextEncoder, TextDecoder } = require('util');
Object.assign(globalThis, { TextEncoder, TextDecoder });
