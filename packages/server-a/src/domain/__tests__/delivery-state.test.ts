import {
  createState, startDelivery, stopDelivery,
  clientConnected, clientDisconnected, status,
} from '../delivery-state';

describe('delivery state', () => {
  it('starts in the delivering state', () => {
    expect(createState(0).delivering).toBe(true);
  });
  it('starts delivering with zero clients', () => {
    const s = createState(1000);
    expect(s).toEqual({ delivering: true, clients: 0, startedAtMs: 1000 });
  });
  it('toggles the delivery flag without mutating the input', () => {
    const s = createState(0);
    const stopped = stopDelivery(s);
    expect(stopped.delivering).toBe(false);
    expect(s.delivering).toBe(true); // original untouched
    expect(startDelivery(stopped).delivering).toBe(true);
  });
  it('tracks client connect/disconnect and never goes negative', () => {
    let s = createState(0);
    s = clientConnected(clientConnected(s));
    expect(s.clients).toBe(2);
    s = clientDisconnected(clientDisconnected(clientDisconnected(s)));
    expect(s.clients).toBe(0);
  });
  it('reports status with uptime in whole seconds', () => {
    const s = startDelivery(clientConnected(createState(1000)));
    expect(status(s, 4200)).toEqual({ videoRunning: true, clientsConnected: 1, uptimeSec: 3 });
  });
});
