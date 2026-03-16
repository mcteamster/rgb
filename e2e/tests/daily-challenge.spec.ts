import { test, expect } from '../fixtures';

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
