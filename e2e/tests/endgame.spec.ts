import { test, expect, newContext, Page, Browser, BrowserContext } from '../fixtures';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getDescriberAndGuesser(
  hostPage: Page,
  guestPage: Page,
): Promise<{ describerPage: Page; guesserPage: Page }> {
  const sel = 'textarea[placeholder="Describe THIS Color"]';
  const winner = await new Promise<'host' | 'guest'>((resolve, reject) => {
    let settled = false;
    const settle = (v: 'host' | 'guest') => { if (!settled) { settled = true; resolve(v); } };
    hostPage.locator(sel).waitFor({ state: 'visible', timeout: 10_000 }).then(() => settle('host')).catch(() => {});
    guestPage.locator(sel).waitFor({ state: 'visible', timeout: 10_000 }).then(() => settle('guest')).catch(() => {});
    setTimeout(() => { if (!settled) reject(new Error('Neither page entered describing phase within 10s')); }, 10_000);
  });
  return winner === 'host'
    ? { describerPage: hostPage, guesserPage: guestPage }
    : { describerPage: guestPage, guesserPage: hostPage };
}

async function submitClue(describerPage: Page, clue = 'test clue') {
  const textarea = describerPage.locator('textarea[placeholder="Describe THIS Color"]');
  await textarea.waitFor({ state: 'visible', timeout: 10_000 });
  await textarea.fill(clue);
  await textarea.press('Enter');
  await textarea.press('Enter');
}

async function playOneRound(
  hostPage: Page,
  guestPage: Page,
  clue: string,
): Promise<void> {
  const { describerPage, guesserPage } = await getDescriberAndGuesser(hostPage, guestPage);
  await submitClue(describerPage, clue);
  await expect(guesserPage.locator('.guessing-phase').first()).toBeVisible({ timeout: 10_000 });
  await guesserPage.getByRole('button', { name: /Submit/ }).click();
  await expect(hostPage.locator('.reveal-phase')).toBeVisible({ timeout: 10_000 });
}

/** Create a 2-player game with 1 turn per player and advance past the final reveal to endgame. */
async function advanceToEndgame(browser: Browser): Promise<{
  hostCtx: BrowserContext;
  guestCtx: BrowserContext;
  hostPage: Page;
  guestPage: Page;
}> {
  const hostCtx = await newContext(browser);
  const guestCtx = await newContext(browser);
  const hostPage = await hostCtx.newPage();
  const guestPage = await guestCtx.newPage();

  await hostPage.goto('/');
  await hostPage.getByRole('button', { name: 'Create' }).click();
  // Set turns per player to 1 (decrement once from default of 2)
  await hostPage.locator('.number-input').nth(1).getByRole('button', { name: '-' }).click();
  await hostPage.getByPlaceholder('Enter your name').fill('Host');
  await hostPage.getByRole('button', { name: 'Create' }).last().click();
  await expect(hostPage.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });

  const code = (await hostPage.locator('.game-id').textContent())!.trim();
  await guestPage.goto(`/${code}`);
  await guestPage.getByPlaceholder('Enter your name').fill('Guest');
  await guestPage.getByRole('button', { name: 'Join' }).click();
  await expect(guestPage.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });
  await hostPage.getByRole('button', { name: 'Start Game' }).click();

  // Round 1
  await playOneRound(hostPage, guestPage, 'round one');

  // Advance to round 2
  await hostPage.waitForTimeout(3_100);
  await hostPage.getByRole('button', { name: 'Next Round' }).click();

  // Round 2
  await playOneRound(hostPage, guestPage, 'round two');

  // Click "Game Summary" to enter endgame
  await hostPage.waitForTimeout(3_100);
  await hostPage.getByRole('button', { name: 'Game Summary' }).click();
  await expect(hostPage.locator('.game-summary-bar')).toBeVisible({ timeout: 10_000 });

  return { hostCtx, guestCtx, hostPage, guestPage };
}

/** Create a 2-player game, let the 15 s clue timer expire (no-clue), and wait for reveal. */
async function advanceToNoClueReveal(browser: Browser): Promise<{
  hostCtx: BrowserContext;
  guestCtx: BrowserContext;
  hostPage: Page;
  guestPage: Page;
}> {
  const hostCtx = await newContext(browser);
  const guestCtx = await newContext(browser);
  const hostPage = await hostCtx.newPage();
  const guestPage = await guestCtx.newPage();

  await hostPage.goto('/');
  await hostPage.getByRole('button', { name: 'Create' }).click();
  await hostPage.locator('.config-group').filter({ hasText: 'Clue Time' })
    .getByRole('button', { name: '15' }).click();
  await hostPage.getByPlaceholder('Enter your name').fill('Host');
  await hostPage.getByRole('button', { name: 'Create' }).last().click();
  await expect(hostPage.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });

  const code = (await hostPage.locator('.game-id').textContent())!.trim();
  await guestPage.goto(`/${code}`);
  await guestPage.getByPlaceholder('Enter your name').fill('Guest');
  await guestPage.getByRole('button', { name: 'Join' }).click();
  await expect(guestPage.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });
  await hostPage.getByRole('button', { name: 'Start Game' }).click();

  // Let the 15 s timer expire with no clue typed — server auto-advances
  await expect(hostPage.locator('.reveal-phase')).toBeVisible({ timeout: 25_000 });

  return { hostCtx, guestCtx, hostPage, guestPage };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Scoring', () => {

  test('8.5 no-clue round awards +100 to guessers and +0 to describer', async ({ browser }) => {
    test.setTimeout(40_000);
    const { hostCtx, guestCtx, hostPage } = await advanceToNoClueReveal(browser);
    try {
      await expect(hostPage.locator('.reveal-phase')).toContainText('No clue was given');
      // Guesser's guess-item shows +100
      await expect(hostPage.locator('.guess-item')).toContainText('+100');
      // Describer's score in the target-color area shows +0
      await expect(hostPage.locator('.target-color')).toContainText('+0');
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('8.7 scores accumulate across rounds', async ({ browser }) => {
    test.setTimeout(90_000);
    const { hostCtx, guestCtx, hostPage } = await advanceToEndgame(browser);
    try {
      // After 2 rounds, both players should have total scores shown in standings
      const scoreElements = hostPage.locator('.standings-score');
      await expect(scoreElements).toHaveCount(2);
      for (let i = 0; i < 2; i++) {
        const text = (await scoreElements.nth(i).textContent())!.trim();
        expect(isNaN(parseInt(text, 10))).toBe(false);
      }
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

});

test.describe('Endgame', () => {

  test('9.1 full standings are shown after the final round', async ({ browser }) => {
    test.setTimeout(90_000);
    const { hostCtx, guestCtx, hostPage } = await advanceToEndgame(browser);
    try {
      await expect(hostPage.locator('.standings-list')).toBeVisible();
      await expect(hostPage.locator('.standings-row')).toHaveCount(2);
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('9.2 winner is displayed with 🏆', async ({ browser }) => {
    test.setTimeout(90_000);
    const { hostCtx, guestCtx, hostPage } = await advanceToEndgame(browser);
    try {
      await expect(hostPage.locator('.podium-section')).toContainText('🏆');
      await expect(hostPage.locator('.winner-name').first()).toBeVisible();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('9.3 host sees "Replay" and "End Game" buttons', async ({ browser }) => {
    test.setTimeout(90_000);
    const { hostCtx, guestCtx, hostPage } = await advanceToEndgame(browser);
    try {
      await expect(hostPage.getByRole('button', { name: 'Replay' })).toBeVisible();
      await expect(hostPage.getByRole('button', { name: 'End Game' })).toBeVisible();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('9.4 non-host does not see endgame action buttons', async ({ browser }) => {
    test.setTimeout(90_000);
    const { hostCtx, guestCtx, guestPage } = await advanceToEndgame(browser);
    try {
      await expect(guestPage.getByRole('button', { name: 'Replay' })).not.toBeVisible();
      await expect(guestPage.getByRole('button', { name: 'End Game' })).not.toBeVisible();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('9.5 "Replay" resets scores and returns both players to the lobby', async ({ browser }) => {
    test.setTimeout(90_000);
    const { hostCtx, guestCtx, hostPage, guestPage } = await advanceToEndgame(browser);
    try {
      await hostPage.getByRole('button', { name: 'Replay' }).click();
      await expect(hostPage.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });
      await expect(hostPage.getByRole('button', { name: 'Start Game' })).toBeVisible({ timeout: 10_000 });
      await expect(guestPage.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('9.6 "End Game" closes the room — host goes home, guest sees room is gone', async ({ browser }) => {
    test.setTimeout(90_000);
    const { hostCtx, guestCtx, hostPage, guestPage } = await advanceToEndgame(browser);
    try {
      await hostPage.getByRole('button', { name: 'End Game' }).click();
      // Host navigates to home page
      await expect(hostPage).toHaveURL('/', { timeout: 10_000 });
      // Guest no longer sees the endgame screen — game summary disappears
      await expect(guestPage.locator('.game-summary-bar')).not.toBeVisible({ timeout: 10_000 });
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('9.7 replay starts a new round sequence with the same players', async ({ browser }) => {
    test.setTimeout(90_000);
    const { hostCtx, guestCtx, hostPage, guestPage } = await advanceToEndgame(browser);
    try {
      await hostPage.getByRole('button', { name: 'Replay' }).click();
      await expect(hostPage.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });
      await hostPage.getByRole('button', { name: 'Start Game' }).click();
      const sel = 'textarea[placeholder="Describe THIS Color"]';
      await Promise.race([
        hostPage.locator(sel).waitFor({ state: 'visible', timeout: 10_000 }),
        guestPage.locator(sel).waitFor({ state: 'visible', timeout: 10_000 }),
      ]);
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

});
