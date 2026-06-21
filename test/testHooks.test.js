import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installTestHooks, isE2EEnabled } from '../src/testHooks.js';

// A minimal stand-in for the Phaser.Game instance the hook reads from.
function makeFakeGame() {
  const mainMenu = { scene: { key: 'MainMenuScene' } };
  return {
    scene: {
      getScenes: () => [mainMenu],
      getScene: () => null, // GameScene not running
    },
  };
}

describe('testHooks', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    localStorage.clear();
  });

  afterEach(() => {
    window.__arena = undefined;
  });

  it('is disabled without the e2e flag', () => {
    expect(isE2EEnabled()).toBe(false);
    installTestHooks(makeFakeGame());
    expect(window.__arena).toBeUndefined();
  });

  it('treats e2e=0 / e2e=false as disabled', () => {
    window.history.replaceState({}, '', '/?e2e=0');
    expect(isE2EEnabled()).toBe(false);
    window.history.replaceState({}, '', '/?e2e=false');
    expect(isE2EEnabled()).toBe(false);
  });

  it('installs a read-only hook when ?e2e=1 is set', () => {
    window.history.replaceState({}, '', '/?e2e=1');
    expect(isE2EEnabled()).toBe(true);

    installTestHooks(makeFakeGame());

    expect(window.__arena.ready).toBe(true);
    expect(window.__arena.activeSceneKeys).toEqual(['MainMenuScene']);
    // GameScene is not active, so live state is null.
    expect(window.__arena.state).toBeNull();
    // The save snapshot is a defaulted object read through Save.
    expect(window.__arena.save).toMatchObject({ version: 2, wallet: 0 });
  });
});
