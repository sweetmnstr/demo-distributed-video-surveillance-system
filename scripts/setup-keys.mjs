import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

// Generates an RS256 key pair. Private key -> Server B only; public key -> Server A
// and GET /publicKey. Idempotent: refuses to overwrite existing keys.
const dir = process.env.KEYS_DIR ?? 'config/keys';
mkdirSync(dir, { recursive: true });

const privatePath = `${dir}/private.pem`;
const publicPath = `${dir}/public.pem`;
if (existsSync(privatePath) || existsSync(publicPath)) {
  console.log('Keys already exist; leaving them untouched.');
  process.exit(0);
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
writeFileSync(publicPath, publicKey.export({ type: 'spki', format: 'pem' }).toString());
console.log(`Wrote ${privatePath} and ${publicPath}`);
