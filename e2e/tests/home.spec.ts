import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('loads and displays the game title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/RGB/i);
  });

  test('shows the room menu', async ({ page }) => {
    await page.goto('/');
    // Room menu should be visible on initial load
    const roomMenu = page.getByRole('button', { name: /create|join|play/i }).first();
    await expect(roomMenu).toBeVisible();
  });

  test('navigates to a room via URL', async ({ page }) => {
    await page.goto('/TESTROOM');
    // Should still load the game container for any room code
    await expect(page).not.toHaveURL('/404');
  });
});
