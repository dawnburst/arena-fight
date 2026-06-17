import { describe, expect, it, vi } from 'vitest';

// Phaser can't be imported under happy-dom (its canvas feature-detection crashes),
// so stub the only Phaser surface viewport.js touches: the Scale constants.
vi.mock('phaser', () => ({
  default: {
    Scale: {
      NONE: 0,
      FIT: 3,
      CENTER_BOTH: 1,
      Events: {
        RESIZE: 'resize',
        ENTER_FULLSCREEN: 'enterfullscreen',
        LEAVE_FULLSCREEN: 'leavefullscreen',
      },
    },
  },
}));

const Phaser = (await import('phaser')).default;
const { mobileGameSize, resolveInitialScaleConfig, MOBILE_MIN_WIDTH, MOBILE_MAX_WIDTH } =
  await import('../src/viewport.js');

describe('mobileGameSize', () => {
  it('holds height at 600 and matches the window aspect', () => {
    // 16:9-ish landscape phone.
    const { width, height } = mobileGameSize(1600, 720);
    expect(height).toBe(600);
    expect(width).toBe(Math.round(600 * (1600 / 720)));
  });

  it('a 4:3 window yields the base 800x600', () => {
    expect(mobileGameSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('clamps an extreme-wide aspect to the max width', () => {
    const { width } = mobileGameSize(5000, 600);
    expect(width).toBe(MOBILE_MAX_WIDTH);
  });

  it('clamps a sub-base aspect to the min width', () => {
    // round(600 * 500/600) = 500, below the floor.
    const { width } = mobileGameSize(500, 600);
    expect(width).toBe(MOBILE_MIN_WIDTH);
  });

  it('falls back to a sane size for degenerate window dimensions', () => {
    expect(mobileGameSize(0, 0)).toEqual({ width: 800, height: 600 });
    expect(mobileGameSize(Number.NaN, Number.NaN)).toEqual({ width: 800, height: 600 });
  });

  it('honours custom height/clamp options', () => {
    const { width, height } = mobileGameSize(1000, 500, { height: 400, maxWidth: 700 });
    expect(height).toBe(400);
    expect(width).toBe(700); // round(400 * 2) = 800, clamped to 700
  });
});

describe('resolveInitialScaleConfig', () => {
  it('desktop stays NONE at the fixed 800x600', () => {
    expect(resolveInitialScaleConfig(false)).toEqual({
      mode: Phaser.Scale.NONE,
      width: 800,
      height: 600,
    });
  });

  it('mobile uses FIT + CENTER_BOTH with an aspect-matched width', () => {
    const cfg = resolveInitialScaleConfig(true, { innerWidth: 1200, innerHeight: 600 });
    expect(cfg.mode).toBe(Phaser.Scale.FIT);
    expect(cfg.autoCenter).toBe(Phaser.Scale.CENTER_BOTH);
    expect(cfg.height).toBe(600);
    expect(cfg.width).toBe(1200);
  });
});
