import { test, expect } from '../fixtures';

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

test.describe('Solo button', () => {
  test('Solo button is visible on home screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /solo/i })).toBeVisible();
  });

  test('Solo button is alongside Create and Join', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /create/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /join/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /solo/i })).toBeVisible();
  });

  test('Solo button navigates to /daily', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /solo/i }).click();
    await expect(page).toHaveURL(/\/daily/);
  });

  test('does not show Color of the Day button when challenge unavailable', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /color of the day/i })).not.toBeVisible();
  });
});
