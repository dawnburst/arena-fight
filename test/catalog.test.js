import { describe, it, expect } from 'vitest';
import {
  WEAPONS,
  MODS,
  WEAPONS_BY_ID,
  MODS_BY_ID,
  getWeapon,
  getMod,
  buildRuntimeStats,
  TIERS,
  TIER_COLORS,
} from '../src/catalog.js';

describe('catalog', () => {
  it('should have weapons and mods', () => {
    expect(WEAPONS.length).toBeGreaterThan(0);
    expect(MODS.length).toBeGreaterThan(0);
  });

  it('getWeapon should return weapon by id or pistol', () => {
    expect(getWeapon('shotgun').name).toBe('Shotgun');
    expect(getWeapon('non-existent').id).toBe('pistol');
  });

  it('getMod should return mod by id or null', () => {
    expect(getMod('quick-draw').name).toBe('Quick Draw');
    expect(getMod('non-existent')).toBeNull();
    expect(getMod(null)).toBeNull();
  });

  it('buildRuntimeStats should aggregate mod effects', () => {
    const stats = buildRuntimeStats(['quick-draw', 'stride']);
    expect(stats.fireRateMult).toBeCloseTo(0.9);
    expect(stats.moveSpeedMult).toBeCloseTo(1.1);
  });

  it('buildRuntimeStats should handle missing mods', () => {
    expect(buildRuntimeStats(null).fireRateMult).toBe(1);
    expect(buildRuntimeStats(undefined).fireRateMult).toBe(1);
    const stats = buildRuntimeStats(['non-existent', null]);
    expect(stats.fireRateMult).toBe(1);
    expect(stats.moveSpeedMult).toBe(1);
  });

  it('should apply all mod effects correctly', () => {
    MODS.forEach(mod => {
      const ctx = {
        fireRateMult: 1,
        moveSpeedMult: 1,
        coinDropMult: 1,
        magnetRangeMult: 1,
        bulletSpeedMult: 1,
        bulletLifetimeMult: 1,
        dashCooldownMult: 1,
        dashSpeedMult: 1,
        maxHpDelta: 0,
        comboResetMsDelta: 0,
        luckyChance: 0,
        phoenixCharges: 0,
      };
      if (mod.apply) {
        mod.apply(ctx);
        // Steel Plate modifies maxHpDelta which is initially 0.
        // Quick Draw modifies fireRateMult which is initially 1.
        const modified = Object.entries(ctx).some(([key, value]) => {
          if (key.endsWith('Mult')) return value !== 1;
          if (key.endsWith('Delta') || key === 'luckyChance' || key === 'phoenixCharges') return value !== 0;
          return false;
        });
        expect(modified, `Mod ${mod.id} should modify at least one stat`).toBe(true);
      }
    });
  });

  it('should have tiers and tier colors', () => {
    expect(TIERS).toContain('common');
    expect(TIER_COLORS.common).toBeDefined();
  });
});
