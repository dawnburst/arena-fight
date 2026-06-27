// Shared scene helpers.

import { achievementBadgeKey } from '../achievements.js';
import { touchActive } from '../input/touchMode.js';

// Touch UI sits above the twin-stick overlay (depth 1000) and the HUD.
const TOUCH_UI_DEPTH = 1500;

// True when the game is running in touch mode (no keyboard). Scenes use this to
// add on-screen equivalents for keyboard-only actions (back, pause/exit, list
// navigation). Desktop returns false, so nothing extra is drawn there.
export function isTouchMode() {
  return touchActive();
}

// Builds a labelled, tappable button anchored in screen space (fixed to the
// camera, high depth). `(x, y)` is the top-left corner. Returns a small API so
// callers can reposition it on resize, relabel it, toggle visibility, or destroy
// it. Used to expose keyboard actions to touch players.
export function addTouchButton(
  scene,
  { x, y, width = 104, height = 46, label, onClick, fontSize = '16px', color = 0x69f0ae },
) {
  const bg = scene.add.graphics().setDepth(TOUCH_UI_DEPTH).setScrollFactor(0);
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      fontSize,
      color: '#ffffff',
    })
    .setOrigin(0.5)
    .setDepth(TOUCH_UI_DEPTH + 1)
    .setScrollFactor(0);

  const draw = (held) => {
    bg.clear();
    bg.fillStyle(held ? color : 0x101710, held ? 0.85 : 0.92);
    bg.fillRoundedRect(0, 0, width, height, 8);
    bg.lineStyle(2, color, 1);
    bg.strokeRoundedRect(0, 0, width, height, 8);
  };

  const zone = scene.add
    .zone(0, 0, width, height)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(TOUCH_UI_DEPTH + 2)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => {
      draw(true);
      onClick?.();
    })
    .on('pointerup', () => draw(false))
    .on('pointerout', () => draw(false));

  const api = {
    zone,
    bg,
    text,
    width,
    height,
    setLabel(value) {
      text.setText(value);
      return api;
    },
    setPosition(nx, ny) {
      bg.setPosition(nx, ny);
      zone.setPosition(nx, ny);
      text.setPosition(nx + width / 2, ny + height / 2);
      return api;
    },
    setVisible(visible) {
      bg.setVisible(visible);
      text.setVisible(visible);
      zone.setVisible(visible);
      if (visible) zone.setInteractive({ useHandCursor: true });
      else zone.disableInteractive();
      return api;
    },
    destroy() {
      bg.destroy();
      text.destroy();
      zone.destroy();
    },
  };

  draw(false);
  api.setPosition(x, y);
  return api;
}

// Adds (or re-fits) a background image that covers the live canvas with no bars
// and no distortion (cover-fit: scale to the larger of the width/height ratios,
// slight crop allowed). Centered on the canvas. Pass an existing image to refit
// it in place (e.g. on resize) instead of creating a new one.
//
// `scene.scale.width/height` are the live logical dimensions, which match the
// fixed 800x600 on desktop and grow with the device on mobile.
export function coverBackground(scene, key, existing = null) {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const source = scene.textures.get(key).getSourceImage();
  const scale = Math.max(w / source.width, h / source.height);
  const image = existing ?? scene.add.image(0, 0, key);
  image
    .setTexture(key)
    .setOrigin(0.5)
    .setPosition(w / 2, h / 2)
    .setScale(scale);
  return image;
}

// Applies the locked/unlocked visual state to a badge object (image or the
// fallback container). Unlocked = full colour; locked = grey tint + dim alpha.
export function applyBadgeState(obj, unlocked) {
  if (unlocked) {
    obj.clearTint?.();
    obj.setAlpha(1);
    if (obj.list) for (const child of obj.list) child.clearTint?.();
  } else {
    obj.setTint?.(0x404040);
    obj.setAlpha(0.45);
    if (obj.list) for (const child of obj.list) child.setTint?.(0x404040);
  }
  return obj;
}

// Adds an achievement badge centred at (x, y), sized to `size`. Uses the
// generated PNG when present; otherwise draws a coloured medallion with the
// achievement's emoji as a graceful fallback so the gallery always renders.
// `tier` is a flattened tier object from achievements.js (ACHIEVEMENT_TIERS).
export function addBadge(scene, x, y, tier, { size = 80, unlocked = true } = {}) {
  const key = achievementBadgeKey(tier.tierId);
  let obj;
  if (scene.textures.exists(key)) {
    obj = scene.add.image(x, y, key).setDisplaySize(size, size);
  } else {
    obj = scene.add.container(x, y);
    const ring = scene.add.circle(0, 0, size / 2, tier.color ?? 0xffd24a, 1);
    ring.setStrokeStyle(Math.max(2, size * 0.04), 0x101010, 0.85);
    const glyph = scene.add
      .text(0, 0, tier.icon || '★', { fontSize: `${Math.round(size * 0.46)}px` })
      .setOrigin(0.5);
    obj.add([ring, glyph]);
  }
  return applyBadgeState(obj, unlocked);
}
