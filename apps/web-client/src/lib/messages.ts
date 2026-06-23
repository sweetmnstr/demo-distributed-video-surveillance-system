import { ControlClientMessage, Command } from '@vss/shared';

export const authMessage = (token: string): ControlClientMessage => ({ type: 'auth', token });

export const commandMessage = (command: Command): ControlClientMessage => ({ type: 'command', command });
