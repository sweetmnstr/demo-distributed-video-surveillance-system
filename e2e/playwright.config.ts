import { defineConfig, devices } from '@playwright/test';

// Runs against the compose stack already up on 127.0.0.1:8080.
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:8080', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
