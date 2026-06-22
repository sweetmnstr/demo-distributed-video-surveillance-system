// Uniform shape returned to the client console for a processed command.
export interface CommandReply {
  readonly ok: boolean;
  readonly text: string;
}
