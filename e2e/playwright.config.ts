import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 5 : undefined,
  reporter: [['html', { open: 'never' }], ['list'], ['json', { outputFile: 'test-results.json' }]],
  timeout: 15_000,

  webServer: isCI ? {
    command: 'npm run build --workspace=client && npx --prefix client vite preview --port 4173',
    cwd: '..',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    env: {
      VITE_DAILY_CHALLENGE_API_URL: 'https://rest.rgb.mcteamster.com',
    },
  } : undefined,

  use: {
    baseURL: isCI ? 'http://localhost:4173' : 'https://rgb.mcteamster.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: isCI
    ? [
        // WebKit (Safari) requires system libraries unavailable in CI — skipped
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
      ]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
        { name: 'mobile-safari', use: { ...devices['iPhone 12'] } },
      ],
});
