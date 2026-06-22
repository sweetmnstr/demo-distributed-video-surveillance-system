import bcryptjs from 'bcryptjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const { hashSync } = bcryptjs;

// Demo users for the prototype. Passwords are intentionally simple and are
// documented in the README; only their bcrypt hashes are persisted.
const SEED = [
  { login: 'operator', password: 'operator123', role: 'operator' },
  { login: 'viewer', password: 'viewer123', role: 'viewer' },
  { login: 'admin', password: 'admin123', role: 'operator' },
];

const outPath = process.env.USERS_PATH ?? 'config/users.json';
const users = SEED.map(({ login, password, role }) => ({
  login,
  passwordHash: hashSync(password, 10),
  role,
}));

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(users, null, 2) + '\n', 'utf8');
console.log(`Wrote ${users.length} users to ${outPath}`);
