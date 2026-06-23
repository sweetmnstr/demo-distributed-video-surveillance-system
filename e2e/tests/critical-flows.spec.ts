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
