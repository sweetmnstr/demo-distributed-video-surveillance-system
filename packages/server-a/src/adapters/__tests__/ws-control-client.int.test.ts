import { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import { InterServerCommand, InterServerResult } from '@vss/shared';
import { createWsControlClient } from '../ws-control-client';

const waitFor = (predicate: () => boolean, ms = 2000) =>
  new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > ms) return reject(new Error('timeout'));
      setTimeout(tick, 20);
    };
    tick();
  });

describe('ws-control-client (integration)', () => {
  it('connects, executes a forwarded command, and replies', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = (wss.address() as AddressInfo).port;
    const replies: InterServerResult[] = [];

    wss.on('connection', (socket: WebSocket) => {
      socket.on('message', (raw) => replies.push(InterServerResult.parse(JSON.parse(String(raw)))));
      const exec: InterServerCommand = { type: 'exec', requestId: 'r1', command: 'START_VIDEO' };
      socket.send(JSON.stringify(exec));
    });

    const client = createWsControlClient({
      serverBUrl: `ws://127.0.0.1:${port}`,
      backoff: { baseMs: 50, capMs: 500 },
      heartbeatMs: 10000,
    });
    client.onCommand(async (command, requestId) => ({ ok: true, text: `ran ${command} (${requestId})` }));
    client.start();

    await waitFor(() => replies.length === 1);
    expect(replies[0]).toEqual({ type: 'result', requestId: 'r1', ok: true, text: 'ran START_VIDEO (r1)' });
    wss.close();
  });
});
