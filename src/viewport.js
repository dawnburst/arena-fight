// Responsive viewport + fullscreen manager.
//
// Desktop windowed stays pixel-identical to the fixed 800x600 canvas (Scale.NONE).
// Desktop fullscreen switches to FIT so the 4:3 layout scales up centered, then
// back to exact 800x600 on exit. Mobile/touch holds a fixed logical HEIGHT (600)
// and grows the logical WIDTH to match the device's window aspect, so Scale.FIT
// fills the screen edge-to-edge with no letterbox bars.
//
// The pure helpers (mobileGameSize, resolveInitialScaleConfig) are unit-tested;
// the DOM/Phaser-bound managers are excluded from coverage like the other
// device-only modules in src/input.

import Phaser from 'phaser';
import { CFG } from './config.js';
import { Save } from './save.js';

const BASE_WIDTH = CFG.arena.width; // 800 — desktop/base width
const BASE_HEIGHT = CFG.arena.height; // 600 — fixed logical height on every platform

// Clamp the mobile logical width so an extreme aspect ratio can't produce an
// absurdly wide (or narrow) arena.
export const MOBILE_MIN_WIDTH = 600;
export const MOBILE_MAX_WIDTH = 1400;

// Compute the logical mobile game size whose aspect matches the window. Holding
// height at BASE_HEIGHT and setting width = round(height * winW/winH) makes the
// logical aspect equal the window aspect, so Scale.FIT fills with no bars.
export function mobileGameSize(winW, winH, opts = {}) {
  const height = opts.height ?? BASE_HEIGHT;
  const minW = opts.minWidth ?? MOBILE_MIN_WIDTH;
  const maxW = opts.maxWidth ?? MOBILE_MAX_WIDTH;
  const safeW = Number.isFinite(winW) && winW > 0 ? winW : BASE_WIDTH;
  const safeH = Number.isFinite(winH) && winH > 0 ? winH : BASE_HEIGHT;
  const raw = Math.round(height * (safeW / safeH));
  const width = Math.min(maxW, Math.max(minW, raw));
  return { width, height };
}

function windowSize(win) {
  const w = win || (typeof window !== 'undefined' ? window : null);
  return {
    width: w?.innerWidth ?? BASE_WIDTH,
    height: w?.innerHeight ?? BASE_HEIGHT,
  };
}

// Build the Phaser `scale` config block used at boot. Desktop is unchanged from
// today (NONE 800x600); mobile starts at FIT with an aspect-matched width.
export function resolveInitialScaleConfig(touch, win) {
  if (!touch) {
    return { mode: Phaser.Scale.NONE, width: BASE_WIDTH, height: BASE_HEIGHT };
  }
  const { width, height } = windowSize(win);
  const size = mobileGameSize(width, height);
  return {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: size.width,
    height: size.height,
  };
}

// Registers the live resize/fullscreen behaviour against a running game.
// - mobile: recompute the aspect-matched logical width on window resize/rotate
//   and push it via setGameSize (fires Phaser's RESIZE event scenes listen to).
// - desktop: swap the scale mode on fullscreen enter/leave so the fixed layout
//   scales up while fullscreen and returns to exact 800x600 on exit.
export function installViewport(game, { touch } = {}) {
  if (!game?.scale) return;
  const scale = game.scale;

  if (touch) {
    const applyMobileSize = () => {
      const { width, height } = windowSize();
      const size = mobileGameSize(width, height);
      if (Math.round(scale.width) !== size.width || Math.round(scale.height) !== size.height) {
        scale.setGameSize(size.width, size.height);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', applyMobileSize);
      window.addEventListener('orientationchange', applyMobileSize);
    }
    applyMobileSize();
    return;
  }

  scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, () => {
    scale.scaleMode = Phaser.Scale.FIT;
    scale.autoCenter = Phaser.Scale.CENTER_BOTH;
    scale.refresh();
  });
  scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, () => {
    scale.scaleMode = Phaser.Scale.NONE;
    scale.autoCenter = Phaser.Scale.NO_CENTER;
    scale.setGameSize(BASE_WIDTH, BASE_HEIGHT);
    scale.refresh();
    // FIT + CENTER_BOTH leaves inflated inline CSS (px width/height plus centering
    // margins) on the canvas. Scale.NONE does not clear them, so without this the
    // canvas keeps its fullscreen size and the page overflows with scrollbars.
    const canvas = scale.canvas || game.canvas;
    if (canvas?.style) {
      canvas.style.width = `${BASE_WIDTH}px`;
      canvas.style.height = `${BASE_HEIGHT}px`;
      canvas.style.marginLeft = '0px';
      canvas.style.marginTop = '0px';
    }
  });
}

// Best-effort landscape lock after entering fullscreen on mobile (reduces the
// rotate prompt). Rejection is expected on desktop/unsupported browsers.
function lockLandscape() {
  try {
    const orientation = typeof screen !== 'undefined' ? screen.orientation : null;
    const result = orientation?.lock?.('landscape');
    result?.catch?.(() => {});
  } catch (_) {
    /* unsupported — ignore */
  }
}

// Enter fullscreen if the persisted preference is on and we aren't already there.
// Must be called from a user-gesture handler (browser requirement).
export function requestFullscreenIfEnabled(scene) {
  if (!scene?.scale) return;
  if (Save.get().settings?.fullscreen === false) return;
  if (scene.scale.isFullscreen) return;
  try {
    scene.scale.startFullscreen();
    lockLandscape();
  } catch (_) {
    /* fullscreen denied — ignore */
  }
}

// Toggle fullscreen from a user-gesture handler.
export function toggleFullscreen(scene) {
  if (!scene?.scale) return;
  try {
    if (scene.scale.isFullscreen) {
      scene.scale.stopFullscreen();
    } else {
      scene.scale.startFullscreen();
      lockLandscape();
    }
  } catch (_) {
    /* fullscreen denied — ignore */
  }
}
