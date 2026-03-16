import { test as base, expect, Browser, BrowserContext } from '@playwright/test';

const BLOCK_PATTERN = '**/api.ohnomer.com/**';
const STUB_RESPONSE = { status: 200, body: '{}' };

// Intercept api.ohnomer.com so E2E test room creations don't pollute tracking data.
// Applies to pages created via the `page` / `context` fixtures.
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(BLOCK_PATTERN, route => route.fulfill(STUB_RESPONSE));
    await use(context);
  },
});

// Helper for tests that create their own browser contexts via `browser.newContext()`
export async function newContext(browser: Browser): Promise<BrowserContext> {
  const ctx = await browser.newContext();
  await ctx.route(BLOCK_PATTERN, route => route.fulfill(STUB_RESPONSE));
  return ctx;
}

export { expect };
export type { Browser, BrowserContext } from '@playwright/test';
export type { Page } from '@playwright/test';
