import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration.
 *
 * Tests run against the Vite dev server (localhost:5173).
 * For full integration testing (daily challenge, multiplayer) the local
 * backend must also be running — see docs/local-development.md.
 *
 * Quick start:
 *   npm run dev:client          # in one terminal
 *   npm run test:e2e            # in another
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Automatically start the Vite dev server when running tests locally.
   * Requires `client/.env.local` to exist — see client/.env.local.example.
   * Skip by setting BASE_URL to an already-running server. */
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev:client --prefix ..',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});
