import bcryptjs from 'bcryptjs';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const { hash } = bcryptjs;

// Demo users for the prototype. Passwords are intentionally simple and are
// documented in the README; only their bcrypt hashes are persisted.
const SEED = [
  { login: 'operator', password: 'operator123', role: 'operator' },
  { login: 'viewer', password: 'viewer123', role: 'viewer' },
  { login: 'admin', password: 'admin123', role: 'operator' },
];

const outPath = process.env.USERS_PATH ?? 'config/users.json';
const users = await Promise.all(
  SEED.map(async ({ login, password, role }) => ({
    login,
    passwordHash: await hash(password, 10),
    role,
  })),
);

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(users, null, 2) + '\n', 'utf8');
console.log(`Wrote ${users.length} users to ${outPath}`);
