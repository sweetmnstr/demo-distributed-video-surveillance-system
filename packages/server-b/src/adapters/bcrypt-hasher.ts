import { compare } from 'bcryptjs';
import { PasswordHasher } from '../ports/password-hasher';

export const createBcryptHasher = (): PasswordHasher => ({
  compare: (plain, hash) => compare(plain, hash),
});
