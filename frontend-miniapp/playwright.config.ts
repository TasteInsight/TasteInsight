import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/_*.spec.ts'],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'zh-CN',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: process.env.E2E_WEB_SERVER_COMMAND || 'pnpm dev:h5 --mode e2e',
    env: { VITE_API_BASE_URL: 'http://127.0.0.1:4523', VITE_ENABLE_TEST_LOGIN: 'true' },
    url: baseURL,
    reuseExistingServer: !!process.env.E2E_BASE_URL && !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  workers: 1,
});
