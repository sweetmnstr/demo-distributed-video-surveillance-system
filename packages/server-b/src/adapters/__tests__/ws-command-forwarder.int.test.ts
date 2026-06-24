import { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import { InterServerCommand, InterServerResult } from '@vss/shared';
import { createWsCommandForwarder } from '../ws-command-forwarder';

const nextTick = () => new Promise((r) => setTimeout(r, 20));

describe('ws-command-forwarder (integration)', () => {
  it('rejects when no Server A is connected (link down)', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const forwarder = createWsCommandForwarder({ wss });
    const reply = await forwarder.forward('GET_STATUS');
    expect(reply.ok).toBe(false);
    expect(reply.text).toContain('unavailable');
    wss.close();
  });

  it('forwards a command and resolves with Server A reply', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const forwarder = createWsCommandForwarder({ wss });
    const port = (wss.address() as AddressInfo).port;

    const fakeA = new WebSocket(`ws://127.0.0.1:${port}`);
    fakeA.on('message', (raw) => {
      const cmd = InterServerCommand.parse(JSON.parse(String(raw)));
      const result: InterServerResult = { type: 'result', requestId: cmd.requestId, ok: true, text: 'video delivery stopped' };
      fakeA.send(JSON.stringify(result));
    });
    await new Promise((r) => fakeA.on('open', r));
    await nextTick();

    const reply = await forwarder.forward('STOP_VIDEO');
    expect(reply).toEqual({ ok: true, text: 'video delivery stopped' });

    fakeA.close();
    wss.close();
  });
});
