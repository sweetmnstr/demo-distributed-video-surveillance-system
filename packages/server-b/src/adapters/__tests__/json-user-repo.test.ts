import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJsonUserRepo } from '../json-user-repo';

// Writes content to a temp file and returns its path.
const fixture = async (content: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'vss-users-'));
  const file = join(dir, 'users.json');
  await writeFile(file, content, 'utf8');
  return file;
};

describe('json-user-repo', () => {
  it('finds an existing user by login', async () => {
    const file = await fixture(
      JSON.stringify([{ login: 'admin', passwordHash: 'hash123', role: 'operator' }]),
    );
    const repo = await createJsonUserRepo(file);
    const user = await repo.findByLogin('admin');
    expect(user).not.toBeNull();
    expect(user?.login).toBe('admin');
    expect(user?.role).toBe('operator');
  });

  it('returns null for a login that does not exist', async () => {
    const file = await fixture(
      JSON.stringify([{ login: 'admin', passwordHash: 'hash123', role: 'operator' }]),
    );
    const repo = await createJsonUserRepo(file);
    const user = await repo.findByLogin('nobody');
    expect(user).toBeNull();
  });

  it('throws when the JSON file is malformed', async () => {
    const file = await fixture('{ not valid json');
    await expect(createJsonUserRepo(file)).rejects.toThrow();
  });

  it('throws when the file does not exist', async () => {
    await expect(createJsonUserRepo('/nonexistent/path/users.json')).rejects.toThrow();
  });
});
