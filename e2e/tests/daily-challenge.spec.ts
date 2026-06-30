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
  test('does not show Previous/Next buttons before submission', async ({ page }) => {
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challengeId: CHALLENGE_STUB.challengeId, prompt: CHALLENGE_STUB.prompt, validFrom: CHALLENGE_STUB.validFrom, validUntil: CHALLENGE_STUB.validUntil, totalSubmissions: 0, userSubmission: null }),
      })
    );
    await page.addInitScript(() => localStorage.setItem('dailyChallengeTipsSeen', 'true'));
    await page.goto('/daily');
    await page.locator('.color-wheel').first().waitFor({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /previous/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /next/i })).not.toBeVisible();
  });

  test('shows Previous and Next buttons after submission', async ({ page }) => {
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challengeId: CHALLENGE_STUB.challengeId, prompt: CHALLENGE_STUB.prompt, validFrom: CHALLENGE_STUB.validFrom, validUntil: CHALLENGE_STUB.validUntil, totalSubmissions: 42, userSubmission: SUBMISSION_STUB }),
      })
    );
    await page.route('**/daily-challenge/stats/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STATS_STUB) })
    );
    await page.addInitScript(() => localStorage.setItem('dailyChallengeTipsSeen', 'true'));
    await page.goto('/daily');
    await expect(page.getByRole('button', { name: /previous/i })).toBeVisible({ timeout: 10_000 });
    // Not today's date so Next should also show
    await expect(page.getByRole('button', { name: /next/i })).toBeVisible({ timeout: 10_000 });
  });

  test('shows combined reveal and stats in one element after submission', async ({ page }) => {
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challengeId: CHALLENGE_STUB.challengeId, prompt: CHALLENGE_STUB.prompt, validFrom: CHALLENGE_STUB.validFrom, validUntil: CHALLENGE_STUB.validUntil, totalSubmissions: 42, userSubmission: SUBMISSION_STUB }),
      })
    );
    await page.route('**/daily-challenge/stats/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STATS_STUB) })
    );
    await page.addInitScript(() => localStorage.setItem('dailyChallengeTipsSeen', 'true'));
    await page.goto('/daily');
    // Score visible
    await expect(page.getByText('87')).toBeVisible({ timeout: 10_000 });
    // Stats visible in same view
    await expect(page.locator('.stats-grid')).toBeVisible({ timeout: 10_000 });
  });

  test('stats request includes userId query param', async ({ page }) => {
    let statsUrl: string | undefined;
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challengeId: CHALLENGE_STUB.challengeId, prompt: CHALLENGE_STUB.prompt, validFrom: CHALLENGE_STUB.validFrom, validUntil: CHALLENGE_STUB.validUntil, totalSubmissions: 42, userSubmission: SUBMISSION_STUB }),
      })
    );
    await page.route('**/daily-challenge/stats/**', route => {
      statsUrl = route.request().url();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STATS_STUB) });
    });
    await page.addInitScript(() => localStorage.setItem('dailyChallengeTipsSeen', 'true'));
    await page.goto('/daily');
    await page.locator('.stats-grid').waitFor({ timeout: 10_000 });
    expect(statsUrl).toContain('userId=');
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
        body: JSON.stringify({ challengeId: CHALLENGE_STUB.challengeId, prompt: CHALLENGE_STUB.prompt, validFrom: CHALLENGE_STUB.validFrom, validUntil: CHALLENGE_STUB.validUntil, totalSubmissions: 0, userSubmission: null }),
      });
    });
    await page.addInitScript(() => localStorage.setItem('dailyChallengeTipsSeen', 'true'));
    await page.goto('/');
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
        body: JSON.stringify({ challengeId: CHALLENGE_STUB.challengeId, prompt: CHALLENGE_STUB.prompt, validFrom: CHALLENGE_STUB.validFrom, validUntil: CHALLENGE_STUB.validUntil, totalSubmissions: 0, userSubmission: null }),
      });
    });
    await page.addInitScript(() => localStorage.setItem('dailyChallengeTipsSeen', 'true'));
    await page.goto('/');
    await page.locator('.color-wheel').first().waitFor({ timeout: 10_000 });
    expect(capturedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const browserLocalDate = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
    expect(capturedDate).toBe(browserLocalDate);
  });

  test('home screen shows Color of the Day button with prompt', async ({ page }) => {
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challengeId: CHALLENGE_STUB.challengeId, prompt: CHALLENGE_STUB.prompt, validFrom: CHALLENGE_STUB.validFrom, validUntil: CHALLENGE_STUB.validUntil, totalSubmissions: 0, userSubmission: null }),
      })
    );
    await page.goto('/');
    await expect(page.getByRole('button', { name: /color of the day/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/ocean blue/i)).toBeVisible({ timeout: 10_000 });
  });

  test('home screen shows result button after submission', async ({ page }) => {
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challengeId: CHALLENGE_STUB.challengeId, prompt: CHALLENGE_STUB.prompt, validFrom: CHALLENGE_STUB.validFrom, validUntil: CHALLENGE_STUB.validUntil, totalSubmissions: 42, userSubmission: SUBMISSION_STUB }),
      })
    );
    await page.goto('/');
    await expect(page.getByRole('button', { name: /87.*details/i })).toBeVisible({ timeout: 10_000 });
  });

  test('history calendar today marker matches browser local date', async ({ page }) => {
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challengeId: CHALLENGE_STUB.challengeId, prompt: CHALLENGE_STUB.prompt, validFrom: CHALLENGE_STUB.validFrom, validUntil: CHALLENGE_STUB.validUntil, totalSubmissions: 0, userSubmission: null }),
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
    // Calendar emoji is now on the left of the banner
    await page.locator('.game-header').getByText('🗓️').click();
    await page.locator('.calendar-months').waitFor({ timeout: 5_000 });
    const todayButton = page.locator('.day-button.today');
    await expect(todayButton).toBeVisible();
    const dayNum = await todayButton.textContent();
    const browserLocalDayOfMonth = await page.evaluate(() => new Date().getDate());
    expect(Number(dayNum)).toBe(browserLocalDayOfMonth);
  });

});
