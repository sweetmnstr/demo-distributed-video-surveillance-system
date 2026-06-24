import { generateKeyPair } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { promisify } from 'node:util';

const generateKeyPairAsync = promisify(generateKeyPair);

// Generates an RS256 key pair. Private key -> Server B only; public key -> Server A
// and GET /publicKey. Idempotent: refuses to overwrite existing keys.
const dir = process.env.KEYS_DIR ?? 'config/keys';
await mkdir(dir, { recursive: true });

const privatePath = `${dir}/private.pem`;
const publicPath = `${dir}/public.pem`;

const exists = (p) => access(p).then(() => true, () => false);
if (await exists(privatePath) || await exists(publicPath)) {
  console.log('Keys already exist; leaving them untouched.');
  process.exit(0);
}

const { privateKey, publicKey } = await generateKeyPairAsync('rsa', { modulusLength: 2048 });
await writeFile(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
await writeFile(publicPath, publicKey.export({ type: 'spki', format: 'pem' }).toString());
console.log(`Wrote ${privatePath} and ${publicPath}`);
