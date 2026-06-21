import { E2E_QUERY, expect, test, waitForHook } from './fixtures.js';

test.describe('smoke / boot', () => {
  test('boots without console or page errors', async ({ page, errors }) => {
    await page.goto(E2E_QUERY);
    await waitForHook(page);

    const canvas = page.locator('#game canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);

    expect(errors.messages).toEqual([]);
  });

  test('intro advances to the main menu', async ({ game }) => {
    await game.startMenu();
    expect(await game.activeScenes()).toContain('MainMenuScene');
  });
});
