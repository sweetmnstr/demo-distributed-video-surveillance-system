import { FormEvent, useState } from 'react';
import { ConsoleLine } from '../../lib/console-log';

export interface ConsoleProps {
  lines: readonly ConsoleLine[];
  onSubmit(raw: string): void;
}

export const Console = ({ lines, onSubmit }: ConsoleProps): JSX.Element => {
  const [input, setInput] = useState('');
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (input.trim().length === 0) return;
    onSubmit(input.trim());
    setInput('');
  };
  return (
    <section aria-labelledby="console-heading">
      <h2 id="console-heading">Command Console</h2>
      <ol>
        {lines.map((line, i) => (
          <li key={i} data-kind={line.kind}>{line.text}</li>
        ))}
      </ol>
      <form onSubmit={submit}>
        <input aria-label="command" value={input} onChange={(e) => setInput(e.target.value)} placeholder="START_VIDEO" />
        <button type="submit">Send</button>
      </form>
    </section>
  );
};
