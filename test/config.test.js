import { describe, expect, it } from 'vitest';
import { CFG } from '../src/config.js';

describe('config', () => {
  it('should be a valid config object', () => {
    expect(CFG).toBeDefined();
    expect(CFG.arena.width).toBe(800);
    expect(CFG.arena.height).toBe(600);
  });

  it('gives dropped coins a finite time-to-live with a warn window', () => {
    expect(CFG.coin.lifetimeMs).toBeGreaterThan(0);
    expect(CFG.coin.warnLastMs).toBeGreaterThan(0);
    expect(CFG.coin.warnLastMs).toBeLessThan(CFG.coin.lifetimeMs);
  });

  it('uses a dark (non-yellow) standard bullet color', () => {
    expect(CFG.bullet.color).toBe(0x37474f);
  });
});
