import { test, expect, Page } from '@playwright/test';

/**
 * Section 3: Room joining
 *
 * Tests 3.1–3.4 and 3.9 are frontend-only (no backend required).
 * Tests 3.5–3.8 and 3.10 require the local backend (gated by SKIP_BACKEND_TESTS).
 */

// ── Helpers ────────────────────────────────────────────────────────────────

/** Navigate to home and open the join form. */
async function openJoinForm(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Join' }).click();
}

/** Create a game and return its room code. */
async function createGame(page: Page, playerName = 'Host'): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByPlaceholder('Enter your name').fill(playerName);
  await page.getByRole('button', { name: 'Create' }).last().click();
  await expect(page.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });
  const code = await page.locator('.game-id').textContent();
  return code!.trim();
}

// ── Frontend-only tests ────────────────────────────────────────────────────

test.describe('Room joining — UI', () => {
  test('3.1 Join button is visible on home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Join' })).toBeVisible();
  });

  test('3.2 Join form shows player name and room code inputs', async ({ page }) => {
    await openJoinForm(page);
    await expect(page.getByPlaceholder('Enter your name')).toBeVisible();
    await expect(page.getByPlaceholder('Enter 4-letter code')).toBeVisible();
  });

  test('3.3 Room code field strips non-consonant characters', async ({ page }) => {
    await openJoinForm(page);
    const codeInput = page.getByPlaceholder('Enter 4-letter code');

    // Type vowels, digits and spaces — all should be stripped
    await codeInput.fill('A1E2');
    await expect(codeInput).toHaveValue('');

    // Valid consonants should pass through and be uppercased
    await codeInput.fill('bcdf');
    await expect(codeInput).toHaveValue('BCDF');
  });

  test('3.4 Player name enforces a maximum length of 16 characters', async ({ page }) => {
    await openJoinForm(page);
    const nameInput = page.getByPlaceholder('Enter your name');
    await nameInput.fill('A'.repeat(20));
    const value = await nameInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(16);
  });

  test('3.x Join button is disabled until code is 4 chars and name is filled', async ({ page }) => {
    await openJoinForm(page);
    const joinBtn = page.getByRole('button', { name: 'Join' });

    // Nothing filled — disabled
    await expect(joinBtn).toBeDisabled();

    // Only name filled — still disabled
    await page.getByPlaceholder('Enter your name').fill('Player');
    await expect(joinBtn).toBeDisabled();

    // Name + 4-char consonant code — enabled
    await page.getByPlaceholder('Enter 4-letter code').fill('BCDF');
    await expect(joinBtn).toBeEnabled();
  });

  test('3.9 Navigating to /:roomCode pre-fills the join form', async ({ page }) => {
    await page.goto('/BCDF');
    // Should be on the join step with the code pre-filled
    await expect(page.getByPlaceholder('Enter 4-letter code')).toHaveValue('BCDF');
    // Name input should be empty or pre-filled from saved name
    await expect(page.getByPlaceholder('Enter your name')).toBeVisible();
  });

  test('3.x Back button returns to choose screen', async ({ page }) => {
    await openJoinForm(page);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join' })).toBeVisible();
  });
});

// ── Backend-dependent tests ────────────────────────────────────────────────

test.describe('Room joining — with backend', () => {
  test.skip(!!process.env.SKIP_BACKEND_TESTS, 'Set SKIP_BACKEND_TESTS=1 to skip backend tests');

  test('3.5 Joining a valid room code adds the player to the lobby', async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    const guestPage = await guestCtx.newPage();

    try {
      const code = await createGame(hostPage, 'Host');

      // Guest joins with the room code
      await guestPage.goto(`/${code}`);
      await guestPage.getByPlaceholder('Enter your name').fill('Guest');
      await guestPage.getByRole('button', { name: 'Join' }).click();

      // Guest should reach the lobby
      await expect(guestPage.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('3.6 Joining with an invalid room code shows an error', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Join' }).click();
    await page.getByPlaceholder('Enter your name').fill('Player');
    await page.getByPlaceholder('Enter 4-letter code').fill('BCDF');
    await page.getByRole('button', { name: 'Join' }).click();

    await expect(page.locator('.error')).toContainText('Game not found', { timeout: 10_000 });
  });

  test('3.8 Joining with a duplicate player name in waiting lobby shows an error', async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    const guestPage = await guestCtx.newPage();

    try {
      const code = await createGame(hostPage, 'SameName');

      await guestPage.goto(`/${code}`);
      await guestPage.getByPlaceholder('Enter your name').fill('SameName');
      await guestPage.getByRole('button', { name: 'Join' }).click();

      await expect(guestPage.locator('.error')).toContainText('already taken', { timeout: 10_000 });
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('3.10 Refreshing the page with a saved session re-joins automatically', async ({ page }) => {
    // Create a game to get a session in localStorage
    await page.goto('/');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.getByPlaceholder('Enter your name').fill('SessionPlayer');
    await page.getByRole('button', { name: 'Create' }).last().click();
    await expect(page.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });

    // Reload — should re-enter lobby without going through the join form
    await page.reload();
    await expect(page.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });

    // Join form should NOT be visible
    await expect(page.getByPlaceholder('Enter your name')).not.toBeVisible();
  });
});
