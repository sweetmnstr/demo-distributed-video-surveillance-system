import { Result, ok, err, canRun, Command, Role } from '@vss/shared';

export const authorizeCommand = (role: Role, command: Command): Result<Command, string> =>
  canRun(role, command) ? ok(command) : err(`insufficient role: ${role} cannot run ${command}`);
