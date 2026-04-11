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
