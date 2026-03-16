import { test, expect, newContext, Page, Browser, BrowserContext } from '../fixtures';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Create a game and land in the lobby. Returns the 4-char room code. */
async function createAndEnterLobby(page: Page, playerName = 'Host'): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByPlaceholder('Enter your name').fill(playerName);
  await page.getByRole('button', { name: 'Create' }).last().click();
  await expect(page.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });
  return (await page.locator('.game-id').textContent())!.trim();
}

/** Join an existing room in a new browser context. Returns { context, page }. */
async function joinRoom(
  browser: Browser,
  code: string,
  playerName: string,
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await newContext(browser);
  const page = await ctx.newPage();
  await page.goto(`/${code}`);
  await page.getByPlaceholder('Enter your name').fill(playerName);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });
  return { ctx, page };
}

/** Open the RoomMenu overlay by clicking the game ID in the navbar. */
async function openRoomMenu(page: Page) {
  await page.locator('.game-id').click();
  await expect(page.locator('.room-menu')).toBeVisible();
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Lobby', () => {

  test('4.1 Host sees the Start Game button (with ≥2 players)', async ({ browser }) => {
    const hostCtx = await newContext(browser);
    const hostPage = await hostCtx.newPage();
    try {
      const code = await createAndEnterLobby(hostPage, 'Host');
      const { ctx: guestCtx } = await joinRoom(browser, code, 'Guest');

      // Host should see the Start Game button once the second player joins
      await expect(hostPage.getByRole('button', { name: 'Start Game' })).toBeVisible({ timeout: 10_000 });

      await guestCtx.close();
    } finally {
      await hostCtx.close();
    }
  });

  test('4.2 Non-host does not see the Start Game button', async ({ browser }) => {
    const hostCtx = await newContext(browser);
    const hostPage = await hostCtx.newPage();
    try {
      const code = await createAndEnterLobby(hostPage, 'Host');
      const { ctx: guestCtx, page: guestPage } = await joinRoom(browser, code, 'Guest');

      // Guest should NOT have the Start Game button
      await expect(guestPage.getByRole('button', { name: 'Start Game' })).not.toBeVisible();

      await guestCtx.close();
    } finally {
      await hostCtx.close();
    }
  });

  test('4.3 Start Game button is not shown with only 1 player', async ({ page }) => {
    await createAndEnterLobby(page, 'Solo');
    // With only 1 player the button should not be rendered
    await expect(page.getByRole('button', { name: 'Start Game' })).not.toBeVisible();
  });

  test('4.4 Start Game button appears once a second player joins', async ({ browser }) => {
    const hostCtx = await newContext(browser);
    const hostPage = await hostCtx.newPage();
    try {
      const code = await createAndEnterLobby(hostPage, 'Host');

      // Before second player joins — no Start Game
      await expect(hostPage.getByRole('button', { name: 'Start Game' })).not.toBeVisible();

      // Second player joins
      const { ctx: guestCtx } = await joinRoom(browser, code, 'Guest');

      // Now Start Game should appear for the host
      await expect(hostPage.getByRole('button', { name: 'Start Game' })).toBeVisible({ timeout: 10_000 });

      await guestCtx.close();
    } finally {
      await hostCtx.close();
    }
  });

  test('4.5 Player list shows the host in the sidebar', async ({ page }) => {
    await createAndEnterLobby(page, 'HostPlayer');
    // PlayerSidebar auto-opens in the lobby — player name should appear
    await expect(page.locator('.player-list')).toContainText('HostPlayer');
  });

  test('4.6 Player list updates in real-time when a second player joins', async ({ browser }) => {
    const hostCtx = await newContext(browser);
    const hostPage = await hostCtx.newPage();
    try {
      const code = await createAndEnterLobby(hostPage, 'Host');

      // Guest joins
      const { ctx: guestCtx } = await joinRoom(browser, code, 'Newcomer');

      // Host's player list should update to show the new player
      await expect(hostPage.locator('.player-list')).toContainText('Newcomer', { timeout: 10_000 });

      await guestCtx.close();
    } finally {
      await hostCtx.close();
    }
  });

  test('4.7 QR code is visible to the host in the room menu', async ({ page }) => {
    await createAndEnterLobby(page, 'Host');
    await openRoomMenu(page);
    // QR code renders as an inline SVG
    await expect(page.locator('.qr-code svg')).toBeVisible();
  });

  test('4.8 Room menu shows the shareable URL', async ({ page }) => {
    await createAndEnterLobby(page, 'Host');
    await openRoomMenu(page);
    const urlText = page.locator('.url-text');
    await expect(urlText).toContainText('rgb.mcteamster.com/');
  });

  test('4.9 Host sees kick (✕) buttons next to other players', async ({ browser }) => {
    const hostCtx = await newContext(browser);
    const hostPage = await hostCtx.newPage();
    try {
      const code = await createAndEnterLobby(hostPage, 'Host');
      const { ctx: guestCtx } = await joinRoom(browser, code, 'KickMe');

      // Wait for KickMe to appear, then check kick button is visible
      await expect(hostPage.locator('.player-list')).toContainText('KickMe', { timeout: 10_000 });
      await expect(hostPage.locator('.kick-button').first()).toBeVisible();

      await guestCtx.close();
    } finally {
      await hostCtx.close();
    }
  });

  test('4.10 Kicked player is redirected away from the lobby', async ({ browser }) => {
    const hostCtx = await newContext(browser);
    const hostPage = await hostCtx.newPage();
    try {
      const code = await createAndEnterLobby(hostPage, 'Host');
      const { ctx: guestCtx, page: guestPage } = await joinRoom(browser, code, 'KickMe');

      await expect(hostPage.locator('.player-list')).toContainText('KickMe', { timeout: 10_000 });

      // Host kicks the guest
      await hostPage.locator('.kick-button').first().click();

      // Guest should leave the lobby (join form or home becomes visible)
      await expect(guestPage.getByRole('button', { name: /Create|Join/ }).first()).toBeVisible({ timeout: 10_000 });

      await guestCtx.close();
    } finally {
      await hostCtx.close();
    }
  });

  test('4.11 Non-host sees Leave Game button in room menu', async ({ browser }) => {
    const hostCtx = await newContext(browser);
    const hostPage = await hostCtx.newPage();
    try {
      const code = await createAndEnterLobby(hostPage, 'Host');
      const { ctx: guestCtx, page: guestPage } = await joinRoom(browser, code, 'Guest');

      await openRoomMenu(guestPage);
      await expect(guestPage.getByRole('button', { name: 'Leave Game' })).toBeVisible();

      await guestCtx.close();
    } finally {
      await hostCtx.close();
    }
  });

  test('4.12 Host sees Reset Game and Close Room buttons in room menu', async ({ page }) => {
    await createAndEnterLobby(page, 'Host');
    await openRoomMenu(page);
    await expect(page.getByRole('button', { name: 'Reset Game' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close Room' })).toBeVisible();
  });

  test('4.13 Closing the room returns all players to the home screen', async ({ browser }) => {
    const hostCtx = await newContext(browser);
    const hostPage = await hostCtx.newPage();
    try {
      const code = await createAndEnterLobby(hostPage, 'Host');
      const { ctx: guestCtx, page: guestPage } = await joinRoom(browser, code, 'Guest');

      // Host closes the room
      await openRoomMenu(hostPage);
      await hostPage.getByRole('button', { name: 'Close Room' }).click();

      // Both players should return to home (Create/Join buttons visible)
      await expect(hostPage.getByRole('button', { name: 'Create' })).toBeVisible({ timeout: 10_000 });
      await expect(guestPage.getByRole('button', { name: /Create|Join/ }).first()).toBeVisible({ timeout: 10_000 });

      await guestCtx.close();
    } finally {
      await hostCtx.close();
    }
  });
});
