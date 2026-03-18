import { test, expect, newContext, Page, Browser, BrowserContext } from '../fixtures';

// ── Types ───────────────────────────────────────────────────────────────────

interface GameSession {
  hostCtx: BrowserContext;
  guestCtx: BrowserContext;
  hostPage: Page;
  guestPage: Page;
  describerPage: Page;
  guesserPage: Page;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function createAndStartGame(
  browser: Browser,
  opts: { guessTimeSetting?: string; turnsOne?: boolean } = {},
): Promise<{ hostCtx: BrowserContext; guestCtx: BrowserContext; hostPage: Page; guestPage: Page }> {
  const hostCtx = await newContext(browser);
  const guestCtx = await newContext(browser);
  const hostPage = await hostCtx.newPage();
  const guestPage = await guestCtx.newPage();

  await hostPage.goto('/');
  await hostPage.getByRole('button', { name: 'Create' }).click();

  if (opts.guessTimeSetting) {
    const guessGroup = hostPage.locator('.config-group').filter({ hasText: 'Guess Time' });
    await guessGroup.getByRole('button', { name: opts.guessTimeSetting }).click();
  }
  if (opts.turnsOne) {
    // Default turns is 2; click decrement once to set to 1
    await hostPage.locator('.number-input').nth(1).getByRole('button', { name: '-' }).click();
  }

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

  return { hostCtx, guestCtx, hostPage, guestPage };
}

async function getDescriberAndGuesser(
  hostPage: Page,
  guestPage: Page,
): Promise<{ describerPage: Page; guesserPage: Page }> {
  const sel = 'textarea[placeholder="Describe THIS Color"]';

  const winner = await new Promise<'host' | 'guest'>((resolve, reject) => {
    let settled = false;
    const settle = (v: 'host' | 'guest') => { if (!settled) { settled = true; resolve(v); } };
    hostPage.locator(sel).waitFor({ state: 'visible', timeout: 8_000 }).then(() => settle('host')).catch(() => {});
    guestPage.locator(sel).waitFor({ state: 'visible', timeout: 8_000 }).then(() => settle('guest')).catch(() => {});
    setTimeout(() => { if (!settled) reject(new Error('Neither page entered describing phase within 8s')); }, 8_000);
  });

  return winner === 'host'
    ? { describerPage: hostPage, guesserPage: guestPage }
    : { describerPage: guestPage, guesserPage: hostPage };
}

async function submitClue(describerPage: Page, clue = 'kind of orange') {
  const textarea = describerPage.locator('textarea[placeholder="Describe THIS Color"]');
  await textarea.waitFor({ state: 'visible', timeout: 10_000 });
  await textarea.fill(clue);
  await textarea.press('Enter');
  await textarea.press('Enter');
}

async function advanceToGuessing(
  browser: Browser,
  opts: { guessTimeSetting?: string } = {},
): Promise<GameSession> {
  const { hostCtx, guestCtx, hostPage, guestPage } = await createAndStartGame(browser, opts);
  const { describerPage, guesserPage } = await getDescriberAndGuesser(hostPage, guestPage);

  await submitClue(describerPage);
  await expect(guesserPage.locator('.guessing-phase').first()).toBeVisible({ timeout: 10_000 });

  return { hostCtx, guestCtx, hostPage, guestPage, describerPage, guesserPage };
}

async function advanceToReveal(browser: Browser, opts: { turnsOne?: boolean } = {}): Promise<GameSession> {
  const { hostCtx, guestCtx, hostPage, guestPage } = await createAndStartGame(browser, opts);
  const { describerPage, guesserPage } = await getDescriberAndGuesser(hostPage, guestPage);

  await submitClue(describerPage);
  await expect(guesserPage.locator('.guessing-phase').first()).toBeVisible({ timeout: 10_000 });

  await guesserPage.getByRole('button', { name: /Submit/ }).click();
  await expect(guesserPage.getByRole('button', { name: /Locked In/ })).toBeVisible({ timeout: 10_000 });
  await expect(hostPage.locator('.reveal-phase')).toBeVisible({ timeout: 10_000 });

  return { hostCtx, guestCtx, hostPage, guestPage, describerPage, guesserPage };
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Guessing phase', () => {

  test('6.1 guessers see the colour wheel and the clue text', async ({ browser }) => {
    const { hostCtx, guestCtx, guesserPage } = await advanceToGuessing(browser);
    try {
      await expect(guesserPage.locator('.color-wheel').first()).toBeVisible();
      await expect(guesserPage.locator('.guessing-phase').first()).toContainText('kind of orange');
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('6.2 clicking the colour wheel updates the selected colour', async ({ browser }) => {
    const { hostCtx, guestCtx, guesserPage } = await advanceToGuessing(browser);
    try {
      const preview = guesserPage.locator('.color-preview-square');
      const before = await preview.evaluate(el => (el as HTMLElement).style.backgroundColor);

      const wheel = guesserPage.locator('.color-wheel').first();
      const box = await wheel.boundingBox();
      // Click on the hue ring (right-centre edge of the wheel)
      await guesserPage.mouse.click(box!.x + box!.width * 0.95, box!.y + box!.height * 0.5);

      const after = await preview.evaluate(el => (el as HTMLElement).style.backgroundColor);
      expect(after).not.toBe(before);
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('6.3 HSL sliders appear when the colour square is clicked', async ({ browser }) => {
    const { hostCtx, guestCtx, guesserPage } = await advanceToGuessing(browser);
    try {
      await expect(guesserPage.locator('.hsl-slider-content')).not.toBeVisible();
      await guesserPage.locator('.color-preview-square').click();
      await expect(guesserPage.locator('.hsl-slider-content')).toBeVisible();
      await expect(guesserPage.locator('input[type="range"]').first()).toBeVisible();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('6.4 submit button locks the guess and shows "Locked In 🔒"', async ({ browser }) => {
    const { hostCtx, guestCtx, guesserPage } = await advanceToGuessing(browser);
    try {
      await guesserPage.getByRole('button', { name: /Submit/ }).click();
      await expect(guesserPage.getByRole('button', { name: /Locked In/ })).toBeVisible();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('6.5 locked guess cannot be changed', async ({ browser }) => {
    const { hostCtx, guestCtx, guesserPage } = await advanceToGuessing(browser);
    try {
      await guesserPage.getByRole('button', { name: /Submit/ }).click();
      await expect(guesserPage.locator('.color-preview-square.locked')).toBeVisible();
      // Clicking the locked square should not open the sliders
      await guesserPage.locator('.color-preview-square.locked').click();
      await expect(guesserPage.locator('.hsl-slider-content')).not.toBeVisible();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('6.6 describer sees submission count', async ({ browser }) => {
    const { hostCtx, guestCtx, describerPage } = await advanceToGuessing(browser);
    try {
      await expect(describerPage.locator('.submissions-count')).toBeVisible();
      await expect(describerPage.locator('.submissions-count')).toContainText('🔒');
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('6.7 draft colour updates are broadcast while the wheel is moved', async ({ browser }) => {
    // Register WS listeners before page navigation so the connection is captured
    const hostCtx = await newContext(browser);
    const guestCtx = await newContext(browser);
    const hostPage = await hostCtx.newPage();
    const guestPage = await guestCtx.newPage();

    const wsMessages: string[] = [];
    const captureFrames = (page: Page) => {
      page.on('websocket', ws => {
        ws.on('framesent', frame => {
          if (typeof frame.payload === 'string') wsMessages.push(frame.payload);
        });
      });
    };
    captureFrames(hostPage);
    captureFrames(guestPage);

    try {
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

      const { describerPage, guesserPage } = await getDescriberAndGuesser(hostPage, guestPage);
      await submitClue(describerPage);
      await expect(guesserPage.locator('.guessing-phase').first()).toBeVisible({ timeout: 10_000 });

      // Move the wheel — draft colour should be broadcast
      const wheel = guesserPage.locator('.color-wheel').first();
      const box = await wheel.boundingBox();
      await guesserPage.mouse.click(box!.x + box!.width * 0.9, box!.y + box!.height * 0.5);
      await guesserPage.waitForTimeout(600);

      expect(wsMessages.some(m => m.includes('updateDraftColor'))).toBe(true);
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('6.8 countdown timer shown when guess time is finite', async ({ browser }) => {
    const { hostCtx, guestCtx, guesserPage } = await advanceToGuessing(browser);
    try {
      // TimerButton shows "⏳ Xs" when timer is active and not disabled
      await expect(guesserPage.getByRole('button', { name: /⏳/ })).toBeVisible();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('6.9 timer expiry auto-submits the current colour selection', async ({ browser }) => {
    test.setTimeout(40_000);
    const { hostCtx, guestCtx, hostPage, guesserPage } = await advanceToGuessing(browser, { guessTimeSetting: '10' });
    try {
      // Don't click submit — timer should fire and auto-submit
      await expect(hostPage.locator('.reveal-phase')).toBeVisible({ timeout: 20_000 });
      void guesserPage; // referenced to satisfy linter
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('6.10 all guessers submitting triggers the reveal phase', async ({ browser }) => {
    const { hostCtx, guestCtx, hostPage, guesserPage } = await advanceToGuessing(browser);
    try {
      await guesserPage.getByRole('button', { name: /Submit/ }).click();
      await expect(hostPage.locator('.reveal-phase')).toBeVisible({ timeout: 10_000 });
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('6.11 describer cannot submit a colour guess during guessing phase', async ({ browser }) => {
    const { hostCtx, guestCtx, describerPage } = await advanceToGuessing(browser);
    try {
      await expect(describerPage.locator('.color-preview-square')).not.toBeVisible();
      await expect(describerPage.getByRole('button', { name: /^Submit/ })).not.toBeVisible();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

});

test.describe('Reveal phase', () => {

  test('7.1 results screen shows each player\'s guessed colour', async ({ browser }) => {
    const { hostCtx, guestCtx, hostPage } = await advanceToReveal(browser);
    try {
      await expect(hostPage.locator('.reveal-phase')).toBeVisible();
      await expect(hostPage.locator('.guess-item').first()).toBeVisible();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('7.2 target colour is shown in the reveal', async ({ browser }) => {
    const { hostCtx, guestCtx, hostPage } = await advanceToReveal(browser);
    try {
      await expect(hostPage.locator('.target-color')).toBeVisible();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('7.3 scores are displayed for the round', async ({ browser }) => {
    const { hostCtx, guestCtx, hostPage } = await advanceToReveal(browser);
    try {
      await expect(hostPage.locator('.guess-item').first()).toContainText('+');
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('7.6 no-clue round shows "No clue was given"', async ({ browser }) => {
    test.setTimeout(40_000);
    const hostCtx = await newContext(browser);
    const guestCtx = await newContext(browser);
    const hostPage = await hostCtx.newPage();
    const guestPage = await guestCtx.newPage();
    try {
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

      await expect(hostPage.getByRole('button', { name: 'Start Game' })).toBeVisible({ timeout: 10_000 });
      await hostPage.getByRole('button', { name: 'Start Game' }).click();

      // Describer types nothing — server auto-advances after 15 s
      await expect(hostPage.locator('.reveal-phase')).toBeVisible({ timeout: 25_000 });
      await expect(hostPage.locator('.reveal-phase')).toContainText('No clue was given');
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('7.7 "Next Round" button is disabled for 3 s after reveal starts', async ({ browser }) => {
    const { hostCtx, guestCtx, hostPage } = await advanceToReveal(browser);
    try {
      // Button should be disabled immediately
      await expect(hostPage.getByRole('button', { name: 'Next Round' })).toBeDisabled();
      // After 3 s it should be enabled
      await hostPage.waitForTimeout(3_100);
      await expect(hostPage.getByRole('button', { name: 'Next Round' })).toBeEnabled();
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('7.8 "Next Round" starts the next describing phase', async ({ browser }) => {
    const { hostCtx, guestCtx, hostPage, guestPage } = await advanceToReveal(browser);
    try {
      await hostPage.waitForTimeout(3_100);
      await hostPage.getByRole('button', { name: 'Next Round' }).click();

      // Either player could be the new describer — wait for describing phase on either page
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

  test('7.9 button label changes to "Game Summary" when all turns are done', async ({ browser }) => {
    test.setTimeout(90_000);
    const { hostCtx, guestCtx, hostPage, guestPage } = await createAndStartGame(browser, { turnsOne: true });
    try {
      // Round 1
      const { describerPage: d1, guesserPage: g1 } = await getDescriberAndGuesser(hostPage, guestPage);
      await submitClue(d1, 'first clue');
      await expect(g1.locator('.guessing-phase').first()).toBeVisible({ timeout: 10_000 });
      await g1.getByRole('button', { name: /Submit/ }).click();
      await expect(hostPage.locator('.reveal-phase')).toBeVisible({ timeout: 10_000 });

      // Click Next Round
      await hostPage.waitForTimeout(3_100);
      await hostPage.getByRole('button', { name: 'Next Round' }).click();

      // Round 2 — roles have swapped
      const { describerPage: d2, guesserPage: g2 } = await getDescriberAndGuesser(hostPage, guestPage);
      await submitClue(d2, 'second clue');
      await expect(g2.locator('.guessing-phase').first()).toBeVisible({ timeout: 10_000 });
      await g2.getByRole('button', { name: /Submit/ }).click();
      await expect(hostPage.locator('.reveal-phase')).toBeVisible({ timeout: 10_000 });

      // Both players have now described once — button should say "Game Summary"
      await expect(hostPage.getByRole('button', { name: 'Game Summary' })).toBeVisible({ timeout: 10_000 });
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test('7.10 host clicking "Next Round" advances the game', async ({ browser }) => {
    const { hostCtx, guestCtx, hostPage, guestPage } = await advanceToReveal(browser);
    try {
      await hostPage.waitForTimeout(3_100);
      await expect(hostPage.getByRole('button', { name: 'Next Round' })).toBeEnabled();
      await hostPage.getByRole('button', { name: 'Next Round' }).click();

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
