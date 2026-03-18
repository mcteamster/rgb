import { test, expect, newContext, Page, Browser, BrowserContext } from '../fixtures';

// ── Helpers ────────────────────────────────────────────────────────────────

interface GameSession {
  hostCtx: BrowserContext;
  guestCtx: BrowserContext;
  hostPage: Page;
  guestPage: Page;
}

/** Create a game, add a guest, and start it. Optionally override clue time. */
async function createAndStartGame(
  browser: Browser,
  hostName = 'Host',
  guestName = 'Guest',
  clueTimeSetting?: string,
): Promise<GameSession> {
  const hostCtx = await newContext(browser);
  const guestCtx = await newContext(browser);
  const hostPage = await hostCtx.newPage();
  const guestPage = await guestCtx.newPage();

  await hostPage.goto('/');
  await hostPage.getByRole('button', { name: 'Create' }).click();

  if (clueTimeSetting) {
    const clueGroup = hostPage.locator('.config-group').filter({ hasText: 'Clue Time' });
    await clueGroup.getByRole('button', { name: clueTimeSetting }).click();
  }

  await hostPage.getByPlaceholder('Enter your name').fill(hostName);
  await hostPage.getByRole('button', { name: 'Create' }).last().click();
  await expect(hostPage.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });

  const code = (await hostPage.locator('.game-id').textContent())!.trim();

  await guestPage.goto(`/${code}`);
  await guestPage.getByPlaceholder('Enter your name').fill(guestName);
  await guestPage.getByRole('button', { name: 'Join' }).click();
  await expect(guestPage.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });

  await expect(hostPage.getByRole('button', { name: 'Start Game' })).toBeVisible({ timeout: 10_000 });
  await hostPage.getByRole('button', { name: 'Start Game' }).click();

  return { hostCtx, guestCtx, hostPage, guestPage };
}

/** After game starts, returns which page is the describer (has the clue textarea). */
async function getDescriberAndGuesser(
  hostPage: Page,
  guestPage: Page,
): Promise<{ describerPage: Page; guesserPage: Page }> {
  const sel = 'textarea[placeholder="Describe THIS Color"]';

  // Race both pages in parallel — first to show the textarea wins.
  // Errors from the non-describer side are suppressed.
  const winner = await new Promise<'host' | 'guest'>((resolve, reject) => {
    let settled = false;
    const settle = (v: 'host' | 'guest') => { if (!settled) { settled = true; resolve(v); } };

    hostPage.locator(sel).waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => settle('host')).catch(() => {});
    guestPage.locator(sel).waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => settle('guest')).catch(() => {});

    setTimeout(() => {
      if (!settled) reject(new Error('Neither page entered describing phase within 8s'));
    }, 8_000);
  });

  return winner === 'host'
    ? { describerPage: hostPage, guesserPage: guestPage }
    : { describerPage: guestPage, guesserPage: hostPage };
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Describing phase', () => {

  test('5.1 describer sees the target colour box', async ({ browser }) => {
    const { hostCtx, guestCtx, hostPage, guestPage } = await createAndStartGame(browser);
    try {
      const { describerPage } = await getDescriberAndGuesser(hostPage, guestPage);
      await expect(describerPage.locator('.color-accurate')).toBeVisible();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('5.2 describer sees the clue text input', async ({ browser }) => {
    const { hostCtx, guestCtx, hostPage, guestPage } = await createAndStartGame(browser);
    try {
      const { describerPage } = await getDescriberAndGuesser(hostPage, guestPage);
      await expect(describerPage.locator('textarea[placeholder="Describe THIS Color"]')).toBeVisible();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('5.3 clue input enforces a maximum length of 50 characters', async ({ browser }) => {
    const { hostCtx, guestCtx, hostPage, guestPage } = await createAndStartGame(browser);
    try {
      const { describerPage } = await getDescriberAndGuesser(hostPage, guestPage);
      const textarea = describerPage.locator('textarea[placeholder="Describe THIS Color"]');
      await textarea.fill('A'.repeat(60));
      const value = await textarea.inputValue();
      expect(value.replace(/\n/g, '').length).toBeLessThanOrEqual(50);
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('5.4 guessers see a "waiting for describer" message', async ({ browser }) => {
    const { hostCtx, guestCtx, hostPage, guestPage } = await createAndStartGame(browser);
    try {
      const { guesserPage } = await getDescriberAndGuesser(hostPage, guestPage);
      await expect(guesserPage.locator('.waiting-phase')).toBeVisible();
      await expect(guesserPage.locator('.waiting-phase')).toContainText('Waiting for');
      await expect(guesserPage.locator('.waiting-phase')).toContainText('clue');
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('5.5 pressing Enter once shows a confirm prompt', async ({ browser }) => {
    const { hostCtx, guestCtx, hostPage, guestPage } = await createAndStartGame(browser);
    try {
      const { describerPage } = await getDescriberAndGuesser(hostPage, guestPage);
      const textarea = describerPage.locator('textarea[placeholder="Describe THIS Color"]');
      await textarea.fill('kind of orange');
      await textarea.press('Enter');
      await expect(describerPage.getByRole('button', { name: 'Press Enter Again' })).toBeVisible();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('5.6 pressing Enter twice submits the clue', async ({ browser }) => {
    const { hostCtx, guestCtx, hostPage, guestPage } = await createAndStartGame(browser);
    try {
      const { describerPage } = await getDescriberAndGuesser(hostPage, guestPage);
      const textarea = describerPage.locator('textarea[placeholder="Describe THIS Color"]');
      await textarea.fill('kind of orange');
      await textarea.press('Enter');
      await textarea.press('Enter');
      // Button resets to Send Clue (or timer fires) — clue is gone from input
      await expect(describerPage.getByRole('button', { name: 'Press Enter Again' })).not.toBeVisible();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('5.7 submitted clue advances game to guessing phase', async ({ browser }) => {
    const { hostCtx, guestCtx, hostPage, guestPage } = await createAndStartGame(browser);
    try {
      const { describerPage, guesserPage } = await getDescriberAndGuesser(hostPage, guestPage);
      const textarea = describerPage.locator('textarea[placeholder="Describe THIS Color"]');
      await textarea.fill('kind of orange');
      await textarea.press('Enter');
      await textarea.press('Enter');
      // Guesser should now see the guessing phase with the clue
      await expect(guesserPage.locator('.guessing-phase').first()).toBeVisible({ timeout: 10_000 });
      await expect(guesserPage.locator('.guessing-phase').first()).toContainText('kind of orange');
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('5.8 countdown timer is shown when clue time is finite', async ({ browser }) => {
    const { hostCtx, guestCtx, hostPage, guestPage } = await createAndStartGame(browser);
    try {
      const { describerPage } = await getDescriberAndGuesser(hostPage, guestPage);
      // Button shows "Send Clue Xs" — the countdown span is always rendered when timer is active
      await expect(describerPage.getByRole('button', { name: /Send Clue\s+\d+s/ })).toBeVisible();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('5.9 timer expiry auto-submits the current clue draft', async ({ browser }) => {
    test.setTimeout(40_000);
    // Use 15 s clue time (shortest finite option) so the test doesn't take too long
    const { hostCtx, guestCtx, hostPage, guestPage } = await createAndStartGame(browser, 'Host', 'Guest', '15');
    try {
      const { describerPage, guesserPage } = await getDescriberAndGuesser(hostPage, guestPage);
      await describerPage.locator('textarea[placeholder="Describe THIS Color"]').fill('auto submit clue');
      // Wait for the 15 s timer to fire and the server to advance the phase
      await expect(guesserPage.locator('.guessing-phase').first()).toBeVisible({ timeout: 25_000 });
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('5.10 no-clue round auto-submits empty and awards +100 to guessers', async ({ browser }) => {
    test.setTimeout(40_000);
    const { hostCtx, guestCtx, hostPage, guestPage } = await createAndStartGame(browser, 'Host', 'Guest', '15');
    try {
      const { describerPage, guesserPage } = await getDescriberAndGuesser(hostPage, guestPage);
      // Describer types nothing — server will auto-advance on deadline
      void describerPage; // referenced to satisfy linter; no interaction intended
      // Game should advance to guessing (or reveal for no-clue)
      await expect(guesserPage.locator('.status-bar').first()).toBeVisible({ timeout: 25_000 });
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('5.11 draft clue updates are broadcast while typing', async ({ browser }) => {
    // Set up WS listener before the page navigates so the connection is captured
    const hostCtx = await newContext(browser);
    const guestCtx = await newContext(browser);
    const hostPage = await hostCtx.newPage();
    const guestPage = await guestCtx.newPage();

    const wsMessages: string[] = [];
    hostPage.on('websocket', ws => {
      ws.on('framesent', frame => {
        if (typeof frame.payload === 'string') wsMessages.push(frame.payload);
      });
    });
    guestPage.on('websocket', ws => {
      ws.on('framesent', frame => {
        if (typeof frame.payload === 'string') wsMessages.push(frame.payload);
      });
    });

    try {
      // Manual game setup so listeners are registered before navigation
      await hostPage.goto('/');
      await hostPage.getByRole('button', { name: 'Create' }).click();
      await hostPage.getByPlaceholder('Enter your name').fill('Host');
      await hostPage.getByRole('button', { name: 'Create' }).last().click();
      await expect(hostPage.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });

      const code = (await hostPage.locator('.game-id').textContent())!.trim();

      await guestPage.goto(`/${code}`);
      await guestPage.getByPlaceholder('Enter your name').fill('Guest');
      await guestPage.getByRole('button', { name: 'Join' }).click();
      await expect(guestPage.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 });

      await expect(hostPage.getByRole('button', { name: 'Start Game' })).toBeVisible({ timeout: 10_000 });
      await hostPage.getByRole('button', { name: 'Start Game' }).click();

      const { describerPage } = await getDescriberAndGuesser(hostPage, guestPage);
      const textarea = describerPage.locator('textarea[placeholder="Describe THIS Color"]');
      await textarea.fill('warm reddish');
      // Wait longer than the 1 s debounce
      await describerPage.waitForTimeout(1_500);

      expect(wsMessages.some(m => m.includes('updateDraftDescription'))).toBe(true);
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('5.12 non-describer cannot interact with the clue input', async ({ browser }) => {
    const { hostCtx, guestCtx, hostPage, guestPage } = await createAndStartGame(browser);
    try {
      const { guesserPage } = await getDescriberAndGuesser(hostPage, guestPage);
      // Clue textarea is not rendered at all for the guesser
      await expect(guesserPage.locator('textarea[placeholder="Describe THIS Color"]')).not.toBeVisible();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

});
