import { expect, test, waitForHook } from './fixtures.js';

const SAVE_KEY = 'arenaFight.save.v1';

test.describe('persistence', () => {
  test('wallet and settings survive a reload', async ({ game }) => {
    await game.startMenu();

    // Seed a known persisted state at an older schema version. mergeDefaults
    // backfills the rest and the migration pipeline upgrades it, so a partial
    // v2 object exercises the real load/migrate path in src/save.js.
    await game.page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: SAVE_KEY,
      value: { version: 2, wallet: 4321, settings: { sfxEnabled: false } },
    });

    await game.page.reload();
    await waitForHook(game.page);

    const save = await game.save();
    // The seed is migrated forward to the current schema version on load.
    expect(save.version).toBe(5);
    expect(save.wallet).toBe(4321);
    expect(save.settings.sfxEnabled).toBe(false);
    // Defaults are backfilled for keys the seed omitted.
    expect(save.settings.musicEnabled).toBe(true);
  });
});
