import { test, expect, newContext, Browser } from '../fixtures';

// ── Section 12: Multiplayer edge cases ───────────────────────────────────────

test.describe('Multiplayer edge cases', () => {

  test('12.8 two simultaneous game creations produce unique room codes', async ({ browser }) => {
    const [ctx1, ctx2] = await Promise.all([newContext(browser), newContext(browser)]);
    const [page1, page2] = await Promise.all([ctx1.newPage(), ctx2.newPage()]);
    try {
      await Promise.all([page1.goto('/'), page2.goto('/')]);
      await Promise.all([
        page1.getByRole('button', { name: 'Create' }).click(),
        page2.getByRole('button', { name: 'Create' }).click(),
      ]);
      await Promise.all([
        page1.getByPlaceholder('Enter your name').fill('PlayerOne'),
        page2.getByPlaceholder('Enter your name').fill('PlayerTwo'),
      ]);
      await Promise.all([
        page1.getByRole('button', { name: 'Create' }).last().click(),
        page2.getByRole('button', { name: 'Create' }).last().click(),
      ]);
      await Promise.all([
        expect(page1.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 }),
        expect(page2.getByText('Lobby Open')).toBeVisible({ timeout: 10_000 }),
      ]);
      const code1 = (await page1.locator('.game-id').textContent())!.trim();
      const code2 = (await page2.locator('.game-id').textContent())!.trim();
      expect(code1).not.toBe(code2);
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });

});

// ── Section 13: Accessibility & responsiveness ───────────────────────────────

test.describe('Responsiveness', () => {

  test('13.3 mobile viewport — home page has no horizontal overflow', async ({ page }) => {
    // The default project uses Pixel 5 (mobile) so this runs at ~393 × 851
    await page.goto('/');
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflow).toBe(false);
  });

  test('13.4 tablet viewport — layout renders without horizontal overflow', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasOverflow).toBe(false);
      // Core interactive elements should still be present
      await expect(page.getByRole('button', { name: /create|join|play/i }).first()).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('13.5 body font size is at least 12 px for legibility', async ({ page }) => {
    await page.goto('/');
    const fontSize = await page.evaluate(
      () => parseFloat(window.getComputedStyle(document.body).fontSize),
    );
    expect(fontSize).toBeGreaterThanOrEqual(12);
  });

});
