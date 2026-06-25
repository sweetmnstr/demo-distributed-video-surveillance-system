import { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import { InterServerCommand, InterServerResult } from '@vss/shared';
import { createWsCommandForwarder } from '../ws-command-forwarder';

const nextTick = () => new Promise((r) => setTimeout(r, 20));

/** Connect a bare WebSocket client and wait until the server has registered it. */
async function connectFakeA(port: number): Promise<WebSocket> {
  const fakeA = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((r) => fakeA.on('open', r));
  await nextTick(); // let the server-side 'connection' handler run
  return fakeA;
}

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

  it('resolves {ok:false} with "timed out" after 5 s when Server A never replies', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const forwarder = createWsCommandForwarder({ wss });
    const port = (wss.address() as AddressInfo).port;

    // Connect but never send a result back.
    const fakeA = await connectFakeA(port);

    // Switch to fake timers only after the WS connection is already established.
    jest.useFakeTimers();
    const replyPromise = forwarder.forward('START_VIDEO');

    // Advance past the 5 000 ms timeout.
    await jest.advanceTimersByTimeAsync(5001);
    jest.useRealTimers();

    const reply = await replyPromise;
    expect(reply.ok).toBe(false);
    expect(reply.text).toContain('timed out');

    fakeA.close();
    wss.close();
  });

  it('ignores a malformed (non-JSON) message from Server A', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const forwarder = createWsCommandForwarder({ wss });
    const port = (wss.address() as AddressInfo).port;

    const fakeA = await connectFakeA(port);
    // Send garbage — must not throw and must not resolve any pending promise.
    fakeA.send('this is not json }{');
    await nextTick();

    // The forwarder should still be healthy: a subsequent valid exchange works.
    const validReplyPromise = forwarder.forward('GET_STATUS');
    fakeA.once('message', (raw) => {
      const cmd = InterServerCommand.parse(JSON.parse(String(raw)));
      const result: InterServerResult = { type: 'result', requestId: cmd.requestId, ok: true, text: 'ok' };
      fakeA.send(JSON.stringify(result));
    });
    const reply = await validReplyPromise;
    expect(reply).toEqual({ ok: true, text: 'ok' });

    fakeA.close();
    wss.close();
  });

  it('ignores a well-formed JSON message that fails InterServerResult schema validation', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const forwarder = createWsCommandForwarder({ wss });
    const port = (wss.address() as AddressInfo).port;

    const fakeA = await connectFakeA(port);
    // Send valid JSON but missing required fields — safeParse must return !success.
    fakeA.send(JSON.stringify({ type: 'unknown', garbage: true }));
    await nextTick();

    // Forwarder must still be operable.
    const validReplyPromise = forwarder.forward('GET_STATUS');
    fakeA.once('message', (raw) => {
      const cmd = InterServerCommand.parse(JSON.parse(String(raw)));
      const result: InterServerResult = { type: 'result', requestId: cmd.requestId, ok: true, text: 'ok' };
      fakeA.send(JSON.stringify(result));
    });
    const reply = await validReplyPromise;
    expect(reply).toEqual({ ok: true, text: 'ok' });

    fakeA.close();
    wss.close();
  });

  it('rejects immediately after Server A disconnects (close handler clears serverA)', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const forwarder = createWsCommandForwarder({ wss });
    const port = (wss.address() as AddressInfo).port;

    const fakeA = await connectFakeA(port);

    // Close the Server-A connection and wait for the close handler to run.
    fakeA.close();
    await nextTick();
    await nextTick(); // two ticks: one for the close event, one for the handler

    const reply = await forwarder.forward('GET_STATUS');
    expect(reply.ok).toBe(false);
    expect(reply.text).toContain('unavailable');

    wss.close();
  });
});
