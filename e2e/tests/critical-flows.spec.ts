import { test, expect, Page } from '@playwright/test';

const login = async (page: Page, user: string, password: string): Promise<void> => {
  await page.goto('/login');
  await page.getByLabel('Login').fill(user);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
};

test('operator logs in and the video element receives data', async ({ page }) => {
  await login(page, 'operator', 'operator123');
  await expect(page.getByRole('heading', { name: 'Live Surveillance' })).toBeVisible();
  await page.getByLabel('command').fill('START_VIDEO');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('li[data-kind="response"]')).toContainText('OK');
  await expect
    .poll(async () => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0);
});

test('viewer is denied STOP_VIDEO (RBAC)', async ({ page }) => {
  await login(page, 'viewer', 'viewer123');
  await page.getByLabel('command').fill('STOP_VIDEO');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('li[data-kind="cmd-error"]')).toContainText('insufficient role');
});

test('LOGOUT revokes the session and forces re-auth', async ({ page }) => {
  await login(page, 'operator', 'operator123');
  await page.getByLabel('command').fill('LOGOUT');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByLabel('command').fill('GET_STATUS');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('li[data-kind="conn-error"]')).toBeVisible();
});

test('docs route renders without authentication', async ({ page }) => {
  await page.goto('/docs');
  await expect(page.getByRole('heading', { name: 'Architecture & Docs' })).toBeVisible();
});

test('operator sends an encrypted command and receives ok', async ({ page }) => {
  await login(page, 'operator', 'operator123');
  await expect(page.getByRole('heading', { name: 'Live Surveillance' })).toBeVisible();

  const result = await page.evaluate(async () => {
    const SERVER_B_HTTP = 'http://127.0.0.1:3000';
    const SERVER_B_WS = 'ws://127.0.0.1:3002';

    const loginRes = await fetch(`${SERVER_B_HTTP}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: 'operator', password: 'operator123' }),
    });
    const { token } = (await loginRes.json()) as { token: string };

    const pem = await (await fetch(`${SERVER_B_HTTP}/publicKey`)).text();
    const pemBody = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const binary = atob(pemBody);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const key = await crypto.subtle.importKey(
      'spki',
      bytes.buffer,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    );
    const cipherBuf = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      key,
      new TextEncoder().encode('STOP_VIDEO'),
    );
    const payload = btoa(String.fromCharCode(...new Uint8Array(cipherBuf)));

    return new Promise<{ ok: boolean; text: string }>((resolve, reject) => {
      const ws = new WebSocket(SERVER_B_WS);
      const timer = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 8000);
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ type: 'auth', token }));
        ws.send(JSON.stringify({ type: 'encrypted', payload }));
      });
      ws.addEventListener('message', ({ data }) => {
        clearTimeout(timer);
        ws.close();
        resolve(JSON.parse(String(data)) as { ok: boolean; text: string });
      });
      ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('ws error')); });
    });
  });

  expect(result.ok).toBe(true);
});
