import { hash } from 'bcryptjs';
import { createBcryptHasher } from '../bcrypt-hasher';

describe('bcrypt-hasher', () => {
  it('verifies a correct password against a pre-hashed value', async () => {
    const hasher = createBcryptHasher();
    const hashed = await hash('secret', 10);
    expect(await hasher.compare('secret', hashed)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hasher = createBcryptHasher();
    const hashed = await hash('secret', 10);
    expect(await hasher.compare('wrong', hashed)).toBe(false);
  });
});
