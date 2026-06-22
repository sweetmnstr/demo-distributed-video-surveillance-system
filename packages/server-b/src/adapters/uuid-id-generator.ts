import { randomUUID } from 'node:crypto';
import { IdGenerator } from '../ports/id-generator';

export const createUuidIdGenerator = (): IdGenerator => ({ next: () => randomUUID() });
