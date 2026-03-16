import { test, expect, Page } from '@playwright/test';

/**
 * Section 2: Room creation
 *
 * Tests 2.1–2.7 are frontend-only (no backend required).
 * Tests 2.8–2.10 require the local backend (gated by SKIP_BACKEND_TESTS).
 */

// ── Helpers ────────────────────────────────────────────────────────────────

/** Navigate to home and open the create form. */
async function openCreateForm(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create' }).click();
}

// ── Frontend-only tests ────────────────────────────────────────────────────

test.describe('Room creation — UI', () => {
  test('2.1 Create button is visible on home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
  });

  test('2.2 Create form shows all configuration controls', async ({ page }) => {
    await openCreateForm(page);
    await expect(page.getByText('Clue Time')).toBeVisible();
    await expect(page.getByText('Guess Time')).toBeVisible();
    await expect(page.getByText('Max Players')).toBeVisible();
    await expect(page.getByText('Turns')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your name')).toBeVisible();
  });

  test('2.3 Estimated duration updates when settings change', async ({ page }) => {
    await openCreateForm(page);
    const summary = page.locator('.config-summary');
    const before = await summary.textContent();

    // Change clue time to 120s (from default 30s)
    await page.getByRole('button', { name: '120' }).click();
    const after = await summary.textContent();

    expect(after).not.toEqual(before);
    await expect(summary).toContainText('minutes');
  });

  test('2.4 Clue time options: 15, 30, 45, 60, 120, OFF', async ({ page }) => {
    await openCreateForm(page);
    for (const label of ['15', '30', '45', '60', '120', 'OFF']) {
      // Each value appears at least once as a button within the Clue Time group
      const clueGroup = page.locator('.config-group').filter({ hasText: 'Clue Time' });
      await expect(clueGroup.getByRole('button', { name: label })).toBeVisible();
    }
  });

  test('2.5 Guess time options: 10, 15, 20, 30, 60, OFF', async ({ page }) => {
    await openCreateForm(page);
    const guessGroup = page.locator('.config-group').filter({ hasText: 'Guess Time' });
    for (const label of ['10', '15', '20', '30', '60', 'OFF']) {
      await expect(guessGroup.getByRole('button', { name: label })).toBeVisible();
    }
  });

  test('2.6 Max players can be incremented and decremented (range 2–10)', async ({ page }) => {
    await openCreateForm(page);
    // Max Players is the first .number-input, Turns is the second (same config-group)
    const maxInput = page.locator('.number-input').first();
    const value = maxInput.locator('.number-value');
    const inc = maxInput.getByRole('button', { name: '+' });
    const dec = maxInput.getByRole('button', { name: '-' });

    // Default is 6; increment to 7
    await expect(value).toHaveText('6');
    await inc.click();
    await expect(value).toHaveText('7');

    // Decrement back to 6
    await dec.click();
    await expect(value).toHaveText('6');
  });

  test('2.6 Max players decrement is disabled at minimum (2)', async ({ page }) => {
    await openCreateForm(page);
    const maxInput = page.locator('.number-input').first();
    const dec = maxInput.getByRole('button', { name: '-' });

    // Click down to 2
    for (let i = 0; i < 4; i++) await dec.click();
    await expect(maxInput.locator('.number-value')).toHaveText('2');
    await expect(dec).toBeDisabled();
  });

  test('2.7 Turns can be incremented and decremented (range 1–5)', async ({ page }) => {
    await openCreateForm(page);
    // Turns is the second .number-input
    const turnsInput = page.locator('.number-input').nth(1);
    const value = turnsInput.locator('.number-value');
    const inc = turnsInput.getByRole('button', { name: '+' });
    const dec = turnsInput.getByRole('button', { name: '-' });

    // Default is 2
    await expect(value).toHaveText('2');
    await inc.click();
    await expect(value).toHaveText('3');
    await dec.click();
    await dec.click();
    await expect(value).toHaveText('1');
    await expect(dec).toBeDisabled();
  });

  test('2.x Submit button is disabled when player name is empty', async ({ page }) => {
    await openCreateForm(page);
    const submit = page.getByRole('button', { name: 'Create' }).last();
    await expect(submit).toBeDisabled();
  });

  test('2.x Back button returns to choose screen', async ({ page }) => {
    await openCreateForm(page);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join' })).toBeVisible();
  });
});

// ── Backend-dependent tests ────────────────────────────────────────────────

test.describe('Room creation — with backend', () => {
  test.skip(!!process.env.SKIP_BACKEND_TESTS, 'Set SKIP_BACKEND_TESTS=1 to skip backend tests');

  test('2.8 Submitting the form creates a game and shows the lobby', async ({ page }) => {
    await openCreateForm(page);
    await page.getByPlaceholder('Enter your name').fill('TestHost');
    await page.getByRole('button', { name: 'Create' }).last().click();

    // Should enter the lobby — navbar shows "Lobby Open"
    await expect(page.getByText('Lobby Open')).toBeVisible({ timeout: 30_000 });
  });

  test('2.9 Room code is 4 characters, consonants only', async ({ page }) => {
    await openCreateForm(page);
    await page.getByPlaceholder('Enter your name').fill('TestHost');
    await page.getByRole('button', { name: 'Create' }).last().click();

    await expect(page.getByText('Lobby Open')).toBeVisible({ timeout: 30_000 });

    const gameId = await page.locator('.game-id').textContent();
    expect(gameId).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
  });

  test('2.10 Session is saved to localStorage after creation', async ({ page }) => {
    await openCreateForm(page);
    await page.getByPlaceholder('Enter your name').fill('TestHost');
    await page.getByRole('button', { name: 'Create' }).last().click();

    await expect(page.getByText('Lobby Open')).toBeVisible({ timeout: 30_000 });

    const session = await page.evaluate(() => localStorage.getItem('rgb-game-session'));
    expect(session).not.toBeNull();
    const parsed = JSON.parse(session!);
    expect(parsed).toHaveProperty('gameId');
    expect(parsed).toHaveProperty('playerId');
  });
});
