export type ConsoleKind = 'out' | 'response' | 'cmd-error' | 'conn-error';

export interface ConsoleLine {
  readonly kind: ConsoleKind;
  readonly text: string;
}

export const outgoing = (command: string): ConsoleLine => ({ kind: 'out', text: `> ${command}` });

export const serverResponse = (ok: boolean, text: string): ConsoleLine =>
  ok
    ? { kind: 'response', text: `< OK: ${text}` }
    : { kind: 'cmd-error', text: `< ERROR: ${text}` };

export const connectionError = (text: string): ConsoleLine => ({ kind: 'conn-error', text: `! CONNECTION: ${text}` });

export const appendLine = (lines: readonly ConsoleLine[], line: ConsoleLine): ConsoleLine[] => [...lines, line];
