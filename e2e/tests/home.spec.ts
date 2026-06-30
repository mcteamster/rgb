import { test, expect } from '../fixtures';

const yesterday = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 5);
  return d.toLocaleDateString('en-CA');
})();

const CHALLENGE_STUB = {
  challengeId: yesterday,
  prompt: 'Ocean Blue',
  validFrom: `${yesterday}T00:00:00Z`,
  validUntil: `${yesterday}T23:59:59Z`,
  totalSubmissions: 42,
};

const SUBMISSION_STUB = {
  color: { h: 180, s: 60, l: 50 },
  score: 87,
  submittedAt: '2026-04-11T12:00:00Z',
  averageColor: { h: 182, s: 62, l: 51 },
};

test.describe('Home page', () => {
  test('loads and displays the game title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/On the Spectrum/i);
  });

  test('shows Create and Join buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /create/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /join/i })).toBeVisible();
  });

  test('navigates to a room via URL', async ({ page }) => {
    await page.goto('/TESTROOM');
    await expect(page).not.toHaveURL('/404');
  });

  test('invalid path redirects to home', async ({ page }) => {
    await page.goto('/AAAA');
    await expect(page).toHaveURL('/');
  });
});

test.describe('Home screen Color of the Day button', () => {
  test('shows button with prompt when challenge is available', async ({ page }) => {
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...CHALLENGE_STUB, userSubmission: null }),
      })
    );
    await page.goto('/');
    await expect(page.getByRole('button', { name: /color of the day/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/ocean blue/i)).toBeVisible();
  });

  test('button appears above Create and Join', async ({ page }) => {
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...CHALLENGE_STUB, userSubmission: null }),
      })
    );
    await page.goto('/');
    const dailyBtn = page.getByRole('button', { name: /color of the day/i });
    const createBtn = page.getByRole('button', { name: /create/i });
    await expect(dailyBtn).toBeVisible({ timeout: 10_000 });
    const dailyBox = await dailyBtn.boundingBox();
    const createBox = await createBtn.boundingBox();
    expect(dailyBox!.y).toBeLessThan(createBox!.y);
  });

  test('shows result button with score after submission', async ({ page }) => {
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...CHALLENGE_STUB, userSubmission: SUBMISSION_STUB }),
      })
    );
    await page.goto('/');
    await expect(page.getByRole('button', { name: /87/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /details/i })).toBeVisible({ timeout: 10_000 });
  });

  test('result button navigates to /daily', async ({ page }) => {
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...CHALLENGE_STUB, userSubmission: SUBMISSION_STUB }),
      })
    );
    await page.goto('/');
    await page.getByRole('button', { name: /details/i }).click();
    await expect(page).toHaveURL(/\/daily/, { timeout: 10_000 });
  });

  test('does not show Color of the Day button when challenge unavailable', async ({ page }) => {
    await page.route('**/daily-challenge/current**', route =>
      route.fulfill({ status: 500, body: 'error' })
    );
    await page.goto('/');
    await page.waitForTimeout(2000);
    await expect(page.getByRole('button', { name: /color of the day/i })).not.toBeVisible();
  });
});
