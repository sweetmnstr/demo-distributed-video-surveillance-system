import { FormEvent, useState } from 'react';
import { COMMANDS, Command, canRun, Role } from '@vss/shared';
import { ConsoleLine } from '../../lib/console-log';

export interface ConsoleProps {
  lines: readonly ConsoleLine[];
  role: Role;
  onSubmit(raw: string): void;
}

export const Console = ({ lines, role, onSubmit }: ConsoleProps): JSX.Element => {
  const allowed = COMMANDS.filter((cmd) => canRun(role, cmd));
  // Every role grants at least one command, so allowed[0] is always defined; the
  // fallback exists only to satisfy the array-index type and is unreachable.
  /* istanbul ignore next -- defensive type guard, no role yields an empty command set */
  const [selected, setSelected] = useState<Command>(allowed[0] ?? 'GET_STATUS');

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    onSubmit(selected);
  };

  return (
    <section className="console card" aria-labelledby="console-heading">
      <h2 id="console-heading" className="console__title">Command Console</h2>
      <ol className="console__log">
        {lines.map((line, i) => (
          <li key={i} data-kind={line.kind} className="console__line">{line.text}</li>
        ))}
      </ol>
      <form className="console__form" onSubmit={submit}>
        <select
          className="console__input"
          aria-label="command"
          value={selected}
          onChange={(e) => setSelected(e.target.value as Command)}
        >
          {allowed.map((cmd) => (
            <option key={cmd} value={cmd}>{cmd}</option>
          ))}
        </select>
        <button type="submit" className="btn btn--primary console__send">Send</button>
      </form>
    </section>
  );
};
