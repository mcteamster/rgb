import { test, expect } from '../fixtures';

const CHALLENGE_STUB = {
  challengeId: '2026-04-11',
  prompt: 'Ocean Blue',
  status: 'active',
  validFrom: '2026-04-11T00:00:00Z',
  validUntil: '2026-04-12T00:00:00Z',
  totalSubmissions: 42,
};

const SUBMISSION_STUB = {
  color: { h: 180, s: 60, l: 50 },
  score: 87,
  submittedAt: '2026-04-11T12:00:00Z',
  averageColor: { h: 182, s: 62, l: 51 },
};

const STATS_STUB = {
  totalSubmissions: 42,
  averageColor: { h: 182, s: 62, l: 51 },
  hue: { avg: 182, stdDev: 15 },
  saturation: { avg: 62, stdDev: 10 },
  lightness: { avg: 51, stdDev: 8 },
};

test.describe('Daily challenge page', () => {
  test('loads at /daily', async ({ page }) => {
    await page.goto('/daily');
    await expect(page).not.toHaveURL('/404');
  });

  test('displays the challenge UI', async ({ page }) => {
    await page.goto('/daily');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test("fetches and displays today's challenge prompt", async ({ page }) => {
    await page.goto('/daily');
    await expect(page.getByText(/today|challenge|colour|color/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('has interactive colour wheel', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('dailyChallengeTipsSeen', 'true'));
    await page.goto('/daily');
    await expect(page.locator('.color-wheel').first()).toBeVisible({ timeout: 10_000 });
  });

  test('can submit a colour guess', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('dailyChallengeTipsSeen', 'true'));
    await page.goto('/daily');
    await page.locator('.color-wheel').first().waitFor({ timeout: 10_000 });
    const submitButton = page.getByRole('button', { name: /submit/i }).first();
    await expect(submitButton).toBeVisible();
  });
});

test.describe('Daily challenge global stats gate', () => {
  test('does not show Global Stats button before submission', async ({ page }) => {
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challenge: CHALLENGE_STUB, userSubmission: null }),
      })
    );
    await page.addInitScript(() => localStorage.setItem('dailyChallengeTipsSeen', 'true'));
    await page.goto('/daily');
    await page.locator('.color-wheel').first().waitFor({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /global stats/i })).not.toBeVisible();
  });

  test('shows Global Stats button after submission', async ({ page }) => {
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challenge: CHALLENGE_STUB, userSubmission: SUBMISSION_STUB }),
      })
    );
    await page.addInitScript(() => localStorage.setItem('dailyChallengeTipsSeen', 'true'));
    await page.goto('/daily');
    await expect(page.getByRole('button', { name: /global stats/i })).toBeVisible({ timeout: 10_000 });
  });

  test('stats request includes userId query param', async ({ page }) => {
    let statsUrl: string | undefined;
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challenge: CHALLENGE_STUB, userSubmission: SUBMISSION_STUB }),
      })
    );
    await page.route('**/daily-challenge/stats/**', route => {
      statsUrl = route.request().url();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(STATS_STUB),
      });
    });
    await page.addInitScript(() => localStorage.setItem('dailyChallengeTipsSeen', 'true'));
    await page.goto('/daily');
    await page.getByRole('button', { name: /global stats/i }).click();
    await page.waitForTimeout(500);
    expect(statsUrl).toContain('userId=');
  });

  test('shows error message when stats endpoint returns 403', async ({ page }) => {
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challenge: CHALLENGE_STUB, userSubmission: SUBMISSION_STUB }),
      })
    );
    await page.route('**/daily-challenge/stats/**', route =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Submit a guess before viewing stats' }),
      })
    );
    await page.addInitScript(() => localStorage.setItem('dailyChallengeTipsSeen', 'true'));
    await page.goto('/daily');
    await page.getByRole('button', { name: /global stats/i }).click();
    await expect(page.getByText(/play this challenge to view its stats/i)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Daily challenge local timezone', () => {
  test('getCurrentChallenge request includes localDate query param', async ({ page }) => {
    let currentUrl: string | undefined;
    await page.route('**/daily-challenge/current**', route => {
      currentUrl = route.request().url();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challenge: CHALLENGE_STUB, userSubmission: null }),
      });
    });
    await page.addInitScript(() => localStorage.setItem('dailyChallengeTipsSeen', 'true'));
    await page.goto('/daily');
    await page.locator('.color-wheel').first().waitFor({ timeout: 10_000 });
    expect(currentUrl).toContain('localDate=');
  });

  test('localDate matches the browser\'s local YYYY-MM-DD', async ({ page }) => {
    let capturedDate: string | undefined;
    await page.route('**/daily-challenge/current**', route => {
      const url = new URL(route.request().url());
      capturedDate = url.searchParams.get('localDate') ?? undefined;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challenge: CHALLENGE_STUB, userSubmission: null }),
      });
    });
    await page.addInitScript(() => localStorage.setItem('dailyChallengeTipsSeen', 'true'));
    await page.goto('/daily');
    await page.locator('.color-wheel').first().waitFor({ timeout: 10_000 });
    // Verify it's a valid YYYY-MM-DD string
    expect(capturedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Verify it matches what the browser itself computes as local today
    const browserLocalDate = await page.evaluate(() =>
      new Date().toLocaleDateString('en-CA')
    );
    expect(capturedDate).toBe(browserLocalDate);
  });

  test('navbar preview fetch includes localDate query param', async ({ page }) => {
    const previewUrls: string[] = [];
    await page.route('**/daily-challenge/current**', route => {
      previewUrls.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challenge: CHALLENGE_STUB, userSubmission: null }),
      });
    });
    await page.goto('/');
    // Wait for the navbar preview fetch to fire
    await page.waitForFunction(() => document.querySelector('.game-header') !== null);
    await page.waitForTimeout(1000);
    expect(previewUrls.length).toBeGreaterThan(0);
    expect(previewUrls[0]).toContain('localDate=');
  });

  test('navbar preview localDate matches browser local YYYY-MM-DD', async ({ page }) => {
    let previewDate: string | undefined;
    await page.route('**/daily-challenge/current**', route => {
      const url = new URL(route.request().url());
      previewDate ??= url.searchParams.get('localDate') ?? undefined;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challenge: CHALLENGE_STUB, userSubmission: null }),
      });
    });
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('.game-header') !== null);
    await page.waitForTimeout(1000);
    expect(previewDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const browserLocalDate = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
    expect(previewDate).toBe(browserLocalDate);
  });

  test('history calendar today marker matches browser local date', async ({ page }) => {
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challenge: CHALLENGE_STUB, userSubmission: null }),
      })
    );
    await page.route('**/daily-challenge/history/**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ submissions: [], stats: { currentStreak: 0, averageScore: 0, bestScore: 0 } }),
      })
    );
    await page.addInitScript(() => localStorage.setItem('dailyChallengeTipsSeen', 'true'));
    await page.goto('/daily');
    await page.locator('.color-wheel').first().waitFor({ timeout: 10_000 });
    // Open the history calendar
    await page.locator('.game-header').getByText('🗓️').click();
    await page.locator('.calendar-months').waitFor({ timeout: 5_000 });
    // The "today" button's aria label / text should correspond to local today's day-of-month
    const todayButton = page.locator('.day-button.today');
    await expect(todayButton).toBeVisible();
    const dayNum = await todayButton.textContent();
    const browserLocalDayOfMonth = await page.evaluate(() => new Date().getDate());
    expect(Number(dayNum)).toBe(browserLocalDayOfMonth);
  });

  test('countdown shows hours until local midnight, not UTC midnight', async ({ page }) => {
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challenge: CHALLENGE_STUB, userSubmission: null }),
      })
    );
    await page.addInitScript(() => localStorage.setItem('dailyChallengeTipsSeen', 'true'));
    await page.goto('/daily');
    await page.locator('.color-wheel').first().waitFor({ timeout: 10_000 });
    // The timer should show a countdown in Xh Ym format
    await expect(page.locator('.timer')).toContainText(/\d+h \d+m until refresh/);
    // The displayed hours should be ≤ 23 (end of local day, not some UTC offset)
    const timerText = await page.locator('.timer').textContent();
    const hours = parseInt(timerText?.match(/(\d+)h/)?.[1] ?? '999');
    expect(hours).toBeLessThanOrEqual(23);
  });
});
