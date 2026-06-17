import { Save } from '../save.js';

// Returns true when the primary pointer is coarse (a touchscreen). Guarded so it
// can run in non-browser environments (tests) without a matchMedia polyfill.
export function isCoarsePointer() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

// Resolves the persisted override ('auto' | 'on' | 'off') against auto-detection.
// `coarse` is injectable so this stays unit-testable without matchMedia.
export function resolveTouchMode(override, coarse = isCoarsePointer()) {
  if (override === 'on') return true;
  if (override === 'off') return false;
  return coarse; // 'auto' or undefined
}

// Convenience: resolves touch mode from the current save. Read once at boot
// (main.js) and in GameScene.create(); changing the setting takes effect on reload.
export function touchActive() {
  return resolveTouchMode(Save.get().settings?.touchControls);
}
