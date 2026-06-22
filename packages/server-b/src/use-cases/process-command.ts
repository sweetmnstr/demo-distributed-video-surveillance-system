import { Command, Session, isErr } from '@vss/shared';
import { AuditLog } from '../ports/audit-log';
import { CommandForwarder } from '../ports/command-forwarder';
import { CommandReply } from '../reply';
import { authorizeCommand } from './authorize-command';

export interface ProcessCommandDeps {
  readonly audit: AuditLog;
  readonly forwarder: CommandForwarder;
}

export const processCommand = async (
  command: Command,
  session: Session,
  deps: ProcessCommandDeps,
): Promise<CommandReply> => {
  await deps.audit.append(session.login, `RECV ${command}`);
  const authorized = authorizeCommand(session.role, command);
  if (isErr(authorized)) {
    await deps.audit.append(session.login, `DENIED ${command}`);
    return { ok: false, text: authorized.error };
  }
  const result = await deps.forwarder.forward(command);
  await deps.audit.append(session.login, `RESULT ${command} ok=${result.ok}`);
  return result;
};
