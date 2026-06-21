import { Command } from '@vss/shared';
import { DeliveryState, startDelivery, stopDelivery, status } from '../domain/delivery-state';

export interface CommandContext {
  getState(): DeliveryState;
  setState(state: DeliveryState): void;
  now(): number;
}

export interface CommandReply {
  readonly ok: boolean;
  readonly text: string;
}

export const handleCommand = (command: Command, ctx: CommandContext): CommandReply => {
  switch (command) {
    case 'START_VIDEO':
      ctx.setState(startDelivery(ctx.getState()));
      return { ok: true, text: 'video delivery started' };
    case 'STOP_VIDEO':
      ctx.setState(stopDelivery(ctx.getState()));
      return { ok: true, text: 'video delivery stopped' };
    case 'GET_STATUS': {
      const s = status(ctx.getState(), ctx.now());
      return {
        ok: true,
        text: `videoRunning=${s.videoRunning} clientsConnected=${s.clientsConnected} uptimeSec=${s.uptimeSec}`,
      };
    }
    case 'LOGOUT':
      return { ok: false, text: 'LOGOUT is handled by the auth server, not Server A' };
  }
};
