import { readFile } from 'node:fs/promises';
import { User } from '@vss/shared';
import { UserRepository } from '../ports/user-repository';

// Loads users.json once into a lookup map keyed by login.
export const createJsonUserRepo = async (usersPath: string): Promise<UserRepository> => {
  const users = JSON.parse(await readFile(usersPath, 'utf8')) as User[];
  const byLogin = new Map(users.map((u) => [u.login, u]));
  return { findByLogin: async (login) => byLogin.get(login) ?? null };
};
