import { Command } from './command';
import { Role } from './types';

const PERMISSIONS: Record<Role, ReadonlySet<Command>> = Object.freeze({
  operator: Object.freeze(new Set<Command>(['START_VIDEO', 'STOP_VIDEO', 'GET_STATUS', 'LOGOUT'])),
  viewer: Object.freeze(new Set<Command>(['GET_STATUS', 'LOGOUT'])),
});

export const canRun = (role: Role, command: Command): boolean => PERMISSIONS[role].has(command);
