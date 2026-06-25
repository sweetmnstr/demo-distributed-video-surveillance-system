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

  it('ignores a malformed inbound JSON message without crashing', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = (wss.address() as AddressInfo).port;
    let serverGotPing = false;

    wss.on('connection', (socket: WebSocket) => {
      // Send malformed JSON first, then a valid command to confirm the client still works
      socket.send('not-valid-json{{');
      const exec: InterServerCommand = { type: 'exec', requestId: 'r2', command: 'GET_STATUS' };
      socket.on('message', () => { serverGotPing = true; });
      setTimeout(() => socket.send(JSON.stringify(exec)), 100);
    });

    const client = createWsControlClient({
      serverBUrl: `ws://127.0.0.1:${port}`,
      backoff: { baseMs: 50, capMs: 500 },
      heartbeatMs: 10000,
    });
    client.onCommand(async () => ({ ok: true, text: 'ok' }));
    client.start();

    await waitFor(() => serverGotPing, 2000);
    expect(serverGotPing).toBe(true);
    wss.close();
  });

  it('ignores a valid-JSON but schema-invalid inbound message', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = (wss.address() as AddressInfo).port;
    let serverGotReply = false;

    wss.on('connection', (socket: WebSocket) => {
      // Send JSON that does not match InterServerCommand schema
      socket.send(JSON.stringify({ notACommand: true }));
      const exec: InterServerCommand = { type: 'exec', requestId: 'r3', command: 'STOP_VIDEO' };
      socket.on('message', () => { serverGotReply = true; });
      setTimeout(() => socket.send(JSON.stringify(exec)), 100);
    });

    const client = createWsControlClient({
      serverBUrl: `ws://127.0.0.1:${port}`,
      backoff: { baseMs: 50, capMs: 500 },
      heartbeatMs: 10000,
    });
    client.onCommand(async () => ({ ok: true, text: 'ok' }));
    client.start();

    await waitFor(() => serverGotReply, 2000);
    expect(serverGotReply).toBe(true);
    wss.close();
  });

  it('closes the socket on error event', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = (wss.address() as AddressInfo).port;
    let clientClosed = false;

    wss.on('connection', (socket: WebSocket) => {
      socket.on('close', () => { clientClosed = true; });
      // Forcibly destroy the underlying socket to trigger an error on the client side
      // Terminate immediately — this sends a TCP RST which the client sees as an error
      socket.terminate();
    });

    const client = createWsControlClient({
      serverBUrl: `ws://127.0.0.1:${port}`,
      backoff: { baseMs: 50, capMs: 500 },
      heartbeatMs: 10000,
    });
    client.start();

    await waitFor(() => clientClosed, 2000);
    expect(clientClosed).toBe(true);
    wss.close();
  });

  it('fires heartbeat ping after the configured interval (real timers, short interval)', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = (wss.address() as AddressInfo).port;
    let pingCount = 0;

    wss.on('connection', (socket: WebSocket) => {
      socket.on('ping', () => { pingCount += 1; });
    });

    // Use a very short heartbeat so we don't need fake timers
    const HEARTBEAT_MS = 100;
    const client = createWsControlClient({
      serverBUrl: `ws://127.0.0.1:${port}`,
      backoff: { baseMs: 50, capMs: 500 },
      heartbeatMs: HEARTBEAT_MS,
    });
    client.start();

    // Wait until at least one ping is received by the server
    await waitFor(() => pingCount >= 1, 3000);

    wss.close();

    expect(pingCount).toBeGreaterThanOrEqual(1);
  });

  it('reconnects after server closes the connection', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = (wss.address() as AddressInfo).port;
    let connectionCount = 0;

    wss.on('connection', (socket: WebSocket) => {
      connectionCount += 1;
      // Close the first connection immediately to trigger client reconnect
      if (connectionCount === 1) {
        socket.close();
      }
    });

    const client = createWsControlClient({
      serverBUrl: `ws://127.0.0.1:${port}`,
      backoff: { baseMs: 30, capMs: 100 },
      heartbeatMs: 10000,
    });
    client.start();

    // Wait for reconnection: server should see at least 2 connections
    await waitFor(() => connectionCount >= 2, 5000);
    expect(connectionCount).toBeGreaterThanOrEqual(2);
    wss.close();
  }, 10000);

  it('uses the default handler (no handler registered) and replies ok:false', async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = (wss.address() as AddressInfo).port;
    const replies: InterServerResult[] = [];

    wss.on('connection', (socket: WebSocket) => {
      socket.on('message', (raw) => replies.push(InterServerResult.parse(JSON.parse(String(raw)))));
      // Send a command immediately — the client has no handler registered, so the
      // default handler (ok: false, text: 'no handler') should reply.
      const exec: InterServerCommand = { type: 'exec', requestId: 'r-default', command: 'GET_STATUS' };
      socket.send(JSON.stringify(exec));
    });

    // Do NOT call client.onCommand() — exercise the built-in default handler.
    const client = createWsControlClient({
      serverBUrl: `ws://127.0.0.1:${port}`,
      backoff: { baseMs: 50, capMs: 500 },
      heartbeatMs: 10000,
    });
    client.start();

    await waitFor(() => replies.length === 1);
    expect(replies[0]).toEqual({ type: 'result', requestId: 'r-default', ok: false, text: 'no handler' });
    wss.close();
  });
});
