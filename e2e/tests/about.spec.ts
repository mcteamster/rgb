import { test, expect } from '@playwright/test';

test.describe('About page', () => {
  test('loads at /about', async ({ page }) => {
    await page.goto('/about');
    await expect(page).not.toHaveURL('/404');
  });

  test('displays about content', async ({ page }) => {
    await page.goto('/about');
    // About page should contain some descriptive text
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('can navigate back to home', async ({ page }) => {
    await page.goto('/about');
    // Close / back button should return to home
    const closeButton = page.getByRole('button', { name: /close|back|home/i }).first();
    await closeButton.click();
    await expect(page).toHaveURL('/');
  });
});
