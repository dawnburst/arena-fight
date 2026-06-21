import { expect, test } from './fixtures.js';

test.describe('gameplay flow', () => {
  test('starts a run, spawns enemies, and scores', async ({ game, errors }) => {
    // Gameplay is driven in real time (fire on the update tick), so allow more
    // than the default per-test budget.
    test.setTimeout(90_000);

    await game.startMenu();

    // START is the default-selected action and starts a non-tutorial run.
    await game.page.keyboard.press('Enter');
    await game.waitForScene('GameScene');

    const state = await game.state();
    expect(state).not.toBeNull();
    expect(state.wave).toBeGreaterThanOrEqual(1);
    expect(state.gameOver).toBe(false);

    // Enemies spawn shortly after the run begins.
    await game.waitForState(() => window.__arena.state?.enemyCount > 0);

    // Hold fire (mouse down) and orbit the aim point around the arena centre so
    // bullets fan out and connect with approaching enemies. Poll the score
    // between moves, giving the game time to fire and register kills.
    const box = await game.page.locator('#game canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const r = Math.min(box.width, box.height) * 0.35;

    await game.page.mouse.move(cx + r, cy);
    await game.page.mouse.down();

    let scored = false;
    const deadline = Date.now() + 60_000;
    for (let i = 0; !scored && Date.now() < deadline; i++) {
      const a = (i / 16) * Math.PI * 2;
      await game.page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a));
      await game.page.waitForTimeout(200);
      const s = await game.state();
      if (!s || s.gameOver) break; // run ended; check whatever score we captured
      scored = s.score > 0;
    }

    await game.page.mouse.up();

    expect(scored).toBe(true);
    expect(errors.messages).toEqual([]);
  });
});
