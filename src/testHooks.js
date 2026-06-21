import { Save } from './save.js';

// Returns true only when the page was opened with an explicit `?e2e=1` flag.
// Values of `0`/`false` (or a missing param) keep the hook disabled so real
// players never get the introspection surface.
export function isE2EEnabled() {
  if (typeof window === 'undefined' || !window.location) return false;
  try {
    const v = new URLSearchParams(window.location.search).get('e2e');
    return v !== null && v !== '0' && v !== 'false';
  } catch {
    return false;
  }
}

// Reads minimal, read-only state from the live GameScene (when running) so the
// Playwright E2E suite can assert real gameplay instead of canvas pixels.
function readGameState(game) {
  const gs = game.scene.getScene('GameScene');
  if (!gs?.scene.isActive()) return null;
  return {
    score: gs.score,
    wave: gs.wave,
    enemyCount: gs.enemies ? gs.enemies.countActive(true) : 0,
    gameOver: gs.gameOver,
  };
}

// Installs `window.__arena` when the e2e flag is set. The surface is read-only
// and inert when the flag is absent: it never mutates gameplay or persistence.
export function installTestHooks(game) {
  if (!isE2EEnabled()) return;
  window.__arena = {
    get ready() {
      return true;
    },
    get activeSceneKeys() {
      return game.scene.getScenes(true).map((s) => s.scene.key);
    },
    get state() {
      return readGameState(game);
    },
    get save() {
      try {
        // Deep clone so tests cannot accidentally mutate the live save cache.
        return JSON.parse(JSON.stringify(Save.get()));
      } catch {
        return null;
      }
    },
  };
}
