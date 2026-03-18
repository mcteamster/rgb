import { test, expect, newContext, Browser } from '../fixtures';

test.describe('Session & reconnection', () => {

  test('11.5 navigating to a room URL without a saved session shows the join form', async ({ browser }) => {
    test.setTimeout(30_000);
    // Create a game to get a valid live room code
    const hostCtx = await newContext(browser);
    const hostPage = await hostCtx.newPage();
    await hostPage.goto('/');
    await hostPage.getByRole('button', { name: 'Create' }).click();
    await hostPage.getByPlaceholder('Enter your name').fill('Host');
    await hostPage.getByRole('button', { name: 'Create' }).last().click();
    await expect(hostPage.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });
    const code = (await hostPage.locator('.game-id').textContent())!.trim();

    // Fresh context — no saved session
    const freshCtx = await newContext(browser);
    const freshPage = await freshCtx.newPage();
    try {
      await freshPage.goto(`/${code}`);
      // Without a session the join form should be presented
      await expect(freshPage.getByPlaceholder('Enter your name')).toBeVisible({ timeout: 10_000 });
    } finally {
      await hostCtx.close();
      await freshCtx.close();
    }
  });

});
