import { test as base, expect } from '@playwright/test';

// The e2e flag that activates the read-only `window.__arena` hook (src/testHooks.js).
export const E2E_QUERY = '?e2e=1';

// Shared helpers for driving the Phaser game through Playwright. These centralize
// the boot/scene-transition knowledge so individual specs stay declarative.
export const test = base.extend({
  // Collects console errors and uncaught page errors for the duration of a test.
  // Specs can assert `errors.messages` is empty after a flow.
  errors: async ({ page }, use) => {
    const messages = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') messages.push(msg.text());
    });
    page.on('pageerror', (err) => messages.push(String(err)));
    await use({
      get messages() {
        return messages;
      },
    });
  },

  // Navigates to the game with the e2e flag, waits for the hook, and starts from
  // a clean save so persistence tests are isolated.
  game: async ({ page }, use) => {
    await page.goto(E2E_QUERY);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForHook(page);
    await use(makeGame(page));
  },
});

export { expect };

// Waits until the `window.__arena` introspection hook is installed.
export async function waitForHook(page) {
  await page.waitForFunction(() => window.__arena?.ready === true, null, {
    timeout: 30_000,
  });
}

// A small facade over the page that exposes the game's test hook to specs.
function makeGame(page) {
  return {
    page,
    activeScenes: () => page.evaluate(() => window.__arena.activeSceneKeys),
    state: () => page.evaluate(() => window.__arena.state),
    save: () => page.evaluate(() => window.__arena.save),

    // Clicks the canvas to leave the Intro (its registered pointerdown handler)
    // and waits for the main menu. Waits for IntroScene to be active first, so
    // the click is not fired before Intro has registered its handler. The click
    // also focuses the canvas so subsequent keyboard hotkeys reach Phaser input.
    async startMenu() {
      await this.waitForScene('IntroScene');
      await page.locator('#game canvas').click();
      await this.waitForScene('MainMenuScene');
    },

    // Polls until `key` is among the active scenes.
    async waitForScene(key) {
      await page.waitForFunction((k) => window.__arena.activeSceneKeys.includes(k), key, {
        timeout: 30_000,
      });
    },

    // Polls until the browser-side `predicate` returns truthy. The predicate runs
    // in the page and should read `window.__arena.state` itself, e.g.
    // `() => window.__arena.state?.enemyCount > 0`.
    async waitForState(predicate) {
      await page.waitForFunction(predicate, null, { timeout: 30_000 });
    },
  };
}
