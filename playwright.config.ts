import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
// Vite binds to `localhost`, which resolves to ::1 on some runners. Pin the dev
// server to IPv4 so the health check below always reaches it.
const HOST = '127.0.0.1';
const baseURL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'], hasTouch: true },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host ${HOST} --port ${PORT} --strictPort`,
    url: `${baseURL}/tests/e2e/harness/harness.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
