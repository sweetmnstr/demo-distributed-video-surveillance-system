import { z } from 'zod';
import { COMMANDS } from '../domain/command';

export const CommandSchema = z.enum(COMMANDS);

export const ControlClientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('command'), command: CommandSchema }),
  z.object({ type: z.literal('encrypted'), payload: z.string().min(1) }),
  z.object({ type: z.literal('auth'), token: z.string().min(1) }),
]);
export type ControlClientMessage = z.infer<typeof ControlClientMessage>;

export const ControlServerMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('response'), ok: z.boolean(), text: z.string() }),
  z.object({ type: z.literal('error'), text: z.string() }),
]);
export type ControlServerMessage = z.infer<typeof ControlServerMessage>;

export const LoginRequest = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequest>;
