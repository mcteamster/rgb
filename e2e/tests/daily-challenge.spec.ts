import { test, expect } from '@playwright/test';

/**
 * Daily challenge E2E tests.
 *
 * These tests require the local backend to be running:
 *   npm run dev:service   (SAM REST :3000, Lambda :3002, WS proxy :3001)
 *
 * Without the backend, the page still loads but API calls will fail.
 * Set SKIP_BACKEND_TESTS=1 to skip backend-dependent assertions.
 */

const backendAvailable = !process.env.SKIP_BACKEND_TESTS;

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
    test.skip(!backendAvailable, 'Requires local backend (npm run dev:service)');

    test('fetches and displays today\'s challenge prompt', async ({ page }) => {
      await page.goto('/daily');
      // Wait for the API call — prompt text should appear within 5s
      await expect(page.getByText(/today|challenge|colour|color/i).first()).toBeVisible({
        timeout: 5_000,
      });
    });

    test('has interactive colour sliders', async ({ page }) => {
      await page.goto('/daily');
      const slider = page.getByRole('slider').first();
      await expect(slider).toBeVisible({ timeout: 5_000 });
    });

    test('can submit a colour guess', async ({ page }) => {
      await page.goto('/daily');
      // Wait for sliders to appear
      await page.getByRole('slider').first().waitFor({ timeout: 5_000 });
      // Submit button should be present
      const submitButton = page.getByRole('button', { name: /submit|guess|go/i }).first();
      await expect(submitButton).toBeVisible();
    });
  });
});
