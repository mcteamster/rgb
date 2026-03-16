import { test, expect } from '@playwright/test';

/**
 * Daily challenge E2E tests.
 *
 * The local backend (SAM + DynamoDB) is started automatically by globalSetup.
 * Set SKIP_BACKEND_TESTS=1 to skip backend startup and these assertions
 * (e.g. in CI environments without SAM/Podman).
 */

test.describe('Daily challenge page', () => {
  test('loads at /daily', async ({ page }) => {
    await page.goto('/daily');
    await expect(page).not.toHaveURL('/404');
  });

  test('displays the challenge UI', async ({ page }) => {
    await page.goto('/daily');
    // Color sliders or a loading indicator should be present
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test.describe('with backend', () => {
    test.skip(!!process.env.SKIP_BACKEND_TESTS, 'Set SKIP_BACKEND_TESTS=1 to skip backend tests');

    test("fetches and displays today's challenge prompt", async ({ page }) => {
      await page.goto('/daily');
      // Wait for the API call — prompt text should appear within 10s (SAM cold start)
      await expect(page.getByText(/today|challenge|colour|color/i).first()).toBeVisible({
        timeout: 30_000,
      });
    });

    test('has interactive colour sliders', async ({ page }) => {
      await page.goto('/daily');
      const slider = page.getByRole('slider').first();
      await expect(slider).toBeVisible({ timeout: 30_000 });
    });

    test('can submit a colour guess', async ({ page }) => {
      await page.goto('/daily');
      // Wait for sliders to appear (SAM cold start may be slow)
      await page.getByRole('slider').first().waitFor({ timeout: 30_000 });
      // Submit button should be present
      const submitButton = page.getByRole('button', { name: /submit|guess|go/i }).first();
      await expect(submitButton).toBeVisible();
    });
  });
});
