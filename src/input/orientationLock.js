// Landscape lock for touch devices. Shows a DOM overlay (#rotate-overlay in
// index.html) when the device is in portrait and freezes the whole Phaser game
// loop until the player rotates back to landscape. Installed from main.js only
// when touch mode is active, so desktop is never affected.

const OVERLAY_ID = 'rotate-overlay';

function isPortrait() {
  if (typeof window === 'undefined') return false;
  return window.innerHeight > window.innerWidth;
}

export function installOrientationLock(game) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const overlay = document.getElementById(OVERLAY_ID);
  const loop = game?.loop;

  const apply = () => {
    const portrait = isPortrait();
    if (overlay) {
      if (portrait) overlay.removeAttribute('hidden');
      else overlay.setAttribute('hidden', '');
    }
    if (!loop) return;
    if (portrait) {
      if (!loop.running) return; // already asleep
      loop.sleep?.();
    } else {
      loop.wake?.();
    }
  };

  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  apply(); // set initial state
}
