import { expect, test } from './fixtures.js';

// Menu hotkey -> destination scene. Each submenu returns to the menu via Escape.
const DESTINATIONS = [
  { key: 's', scene: 'StoreScene' },
  { key: 'l', scene: 'LoadoutScene' },
  { key: 'm', scene: 'MonstersScene' },
  { key: 'o', scene: 'SettingsScene' },
];

test.describe('scene navigation', () => {
  test('opens every submenu and returns to the menu', async ({ game, errors }) => {
    await game.startMenu();

    for (const { key, scene } of DESTINATIONS) {
      await game.page.keyboard.press(key);
      await game.waitForScene(scene);
      expect(await game.activeScenes()).toContain(scene);

      await game.page.keyboard.press('Escape');
      await game.waitForScene('MainMenuScene');
      expect(await game.activeScenes()).toContain('MainMenuScene');
    }

    expect(errors.messages).toEqual([]);
  });
});
