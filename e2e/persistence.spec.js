import { expect, test, waitForHook } from './fixtures.js';

const SAVE_KEY = 'arenaFight.save.v1';

test.describe('persistence', () => {
  test('wallet and settings survive a reload', async ({ game }) => {
    await game.startMenu();

    // Seed a known persisted state. mergeDefaults backfills the rest, so a
    // partial object exercises the real load/migrate path in src/save.js.
    await game.page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: SAVE_KEY,
      value: { version: 2, wallet: 4321, settings: { sfxEnabled: false } },
    });

    await game.page.reload();
    await waitForHook(game.page);

    const save = await game.save();
    expect(save.version).toBe(2);
    expect(save.wallet).toBe(4321);
    expect(save.settings.sfxEnabled).toBe(false);
    // Defaults are backfilled for keys the seed omitted.
    expect(save.settings.musicEnabled).toBe(true);
  });
});
