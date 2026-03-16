import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright E2E test configuration.
 *
 * By default, globalSetup starts the full local stack automatically:
 *   DynamoDB Local → seed → SAM REST (:3000) + Lambda (:3002) + WS proxy (:3001)
 *
 * The Vite dev server (:5173) is started via webServer below.
 *
 * Set SKIP_BACKEND_TESTS=1 to skip backend startup and backend-dependent tests.
 *
 * Quick start (everything automatic):
 *   npm run test:e2e
 *
 * Prerequisites:
 *   - Podman running (DOCKER_HOST set in service/.env.local)
 *   - AWS SAM CLI installed
 *   - npm install && npm run build --workspace=service
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list'], ['json', { outputFile: 'test-results.json' }]],
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  timeout: 60_000, // SAM cold starts can be slow on first run

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: process.env.CI
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      ]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
        { name: 'mobile-safari', use: { ...devices['iPhone 12'] } },
      ],

  /* Automatically start the Vite dev server when running tests locally.
   * Requires `client/.env.local` to exist — see client/.env.local.example.
   * Skip by setting BASE_URL to an already-running server. */
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev --workspace=client',
        cwd: path.resolve(__dirname, '..'),
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});
