export interface DeliveryState {
  readonly delivering: boolean;
  readonly clients: number;
  readonly startedAtMs: number;
}

export interface Status {
  readonly videoRunning: boolean;
  readonly clientsConnected: number;
  readonly uptimeSec: number;
}

export const createState = (nowMs: number): DeliveryState => ({
  delivering: false,
  clients: 0,
  startedAtMs: nowMs,
});

export const startDelivery = (s: DeliveryState): DeliveryState => ({ ...s, delivering: true });
export const stopDelivery = (s: DeliveryState): DeliveryState => ({ ...s, delivering: false });
export const clientConnected = (s: DeliveryState): DeliveryState => ({ ...s, clients: s.clients + 1 });
export const clientDisconnected = (s: DeliveryState): DeliveryState => ({
  ...s,
  clients: Math.max(0, s.clients - 1),
});

export const status = (s: DeliveryState, nowMs: number): Status => ({
  videoRunning: s.delivering,
  clientsConnected: s.clients,
  uptimeSec: Math.floor((nowMs - s.startedAtMs) / 1000),
});
