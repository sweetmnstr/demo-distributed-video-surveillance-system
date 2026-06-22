import { User } from '@vss/shared';

export interface UserRepository {
  findByLogin(login: string): Promise<User | null>;
}
