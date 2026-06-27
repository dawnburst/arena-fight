import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENT_TIER_COUNT,
  ACHIEVEMENT_TIERS,
  ACHIEVEMENTS,
  ACHIEVEMENTS_BY_ID,
  bestUnlock,
  evaluateAchievements,
  playerLevel,
  TIER_BY_ID,
  tierProgress,
  unlockedPoints,
} from '../src/achievements.js';
import { WEAPONS } from '../src/catalog.js';

function ctx({ run = {}, stats = {}, save = {} } = {}) {
  return {
    run,
    stats,
    save: { ownedWeapons: ['pistol'], achievements: [], ...save },
  };
}

describe('achievements definitions', () => {
  it('every achievement has a unique id, name and category', () => {
    const ids = new Set();
    for (const ach of ACHIEVEMENTS) {
      expect(typeof ach.id).toBe('string');
      expect(typeof ach.name).toBe('string');
      expect(typeof ach.category).toBe('string');
      expect(Array.isArray(ach.tiers) || typeof ach.check === 'function').toBe(true);
      expect(ids.has(ach.id)).toBe(false);
      ids.add(ach.id);
    }
    expect(Object.keys(ACHIEVEMENTS_BY_ID).length).toBe(ACHIEVEMENTS.length);
  });

  it('flattens into unique tier ids with positive targets and points', () => {
    const ids = new Set();
    for (const tier of ACHIEVEMENT_TIERS) {
      expect(ids.has(tier.tierId)).toBe(false);
      ids.add(tier.tierId);
      expect(tier.target).toBeGreaterThan(0);
      expect(tier.points).toBeGreaterThan(0);
      expect(TIER_BY_ID[tier.tierId]).toBe(tier);
    }
    expect(ACHIEVEMENT_TIER_COUNT).toBe(ACHIEVEMENT_TIERS.length);
  });

  it('expands tiered achievements into four tiers each', () => {
    expect(ACHIEVEMENT_TIERS.filter((t) => t.achId === 'wave-climber')).toHaveLength(4);
    expect(TIER_BY_ID['wave-climber-1'].target).toBe(10);
    expect(TIER_BY_ID['wave-climber-4'].target).toBe(100);
    expect(TIER_BY_ID['wave-climber-1'].points).toBeLessThan(TIER_BY_ID['wave-climber-4'].points);
  });

  it('combo Diamond tier matches the x50 combo cap', () => {
    expect(TIER_BY_ID['combo-4'].target).toBe(50);
    expect(evaluateAchievements(ctx({ stats: { bestCombo: 50 } }), [])).toContain('combo-4');
    expect(evaluateAchievements(ctx({ stats: { bestCombo: 49 } }), [])).not.toContain('combo-4');
  });
});

describe('evaluateAchievements — tiered', () => {
  it('unlocks only the tiers whose target the cumulative stat meets', () => {
    const newly = evaluateAchievements(ctx({ stats: { bestWave: 30 } }), []);
    expect(newly).toContain('wave-climber-1'); // 10
    expect(newly).toContain('wave-climber-2'); // 25
    expect(newly).not.toContain('wave-climber-3'); // 50
  });

  it('crosses into a new tier as the stat grows, without re-reporting old tiers', () => {
    const first = evaluateAchievements(ctx({ stats: { bestWave: 12 } }), []);
    expect(first).toEqual(['wave-climber-1']);
    const second = evaluateAchievements(ctx({ stats: { bestWave: 80 } }), first);
    expect(second).toContain('wave-climber-2'); // 25
    expect(second).toContain('wave-climber-3'); // 70
    expect(second).not.toContain('wave-climber-1');
  });

  it('is idempotent on already-unlocked tier ids', () => {
    const all = evaluateAchievements(
      ctx({ stats: { bestWave: 100, totalKills: 10000, bossesDefeated: 50, bestCombo: 20 } }),
      [],
    );
    const again = evaluateAchievements(
      ctx({ stats: { bestWave: 100, totalKills: 10000, bossesDefeated: 50, bestCombo: 20 } }),
      all,
    );
    expect(again).toEqual([]);
  });
});

describe('evaluateAchievements — boolean', () => {
  it('first-blood unlocks on a kill or lifetime kills', () => {
    expect(evaluateAchievements(ctx({ run: { kills: 1 } }), [])).toContain('first-blood');
    expect(evaluateAchievements(ctx({ stats: { totalKills: 5 } }), [])).toContain('first-blood');
    expect(evaluateAchievements(ctx(), [])).not.toContain('first-blood');
  });

  it('sharpshooter needs 80%+ accuracy over 50+ shots', () => {
    const fn = ACHIEVEMENTS_BY_ID.sharpshooter.check;
    expect(fn(ctx({ run: { shotsFired: 40, shotsHit: 40 } }))).toBe(false);
    expect(fn(ctx({ run: { shotsFired: 100, shotsHit: 79 } }))).toBe(false);
    expect(fn(ctx({ run: { shotsFired: 100, shotsHit: 80 } }))).toBe(true);
  });

  it('untouchable needs a no-hit boss kill', () => {
    const fn = ACHIEVEMENTS_BY_ID.untouchable.check;
    expect(fn(ctx({ run: { bossNoHit: false } }))).toBe(false);
    expect(fn(ctx({ run: { bossNoHit: true } }))).toBe(true);
  });

  it('arsenal needs every weapon owned', () => {
    const all = WEAPONS.map((w) => w.id);
    expect(evaluateAchievements(ctx({ save: { ownedWeapons: ['pistol'] } }), [])).not.toContain(
      'arsenal',
    );
    expect(evaluateAchievements(ctx({ save: { ownedWeapons: all } }), [])).toContain('arsenal');
  });

  it('survives a throwing check without crashing', () => {
    expect(() => evaluateAchievements({ run: null, save: null, stats: null }, [])).not.toThrow();
  });
});

describe('progress, points and showcase helpers', () => {
  it('tierProgress clamps to the tier target', () => {
    const tier = TIER_BY_ID['slayer-2']; // 500
    expect(tierProgress(ctx({ stats: { totalKills: 250 } }), tier)).toMatchObject({
      current: 250,
      target: 500,
    });
    expect(tierProgress(ctx({ stats: { totalKills: 9999 } }), tier).current).toBe(500);
  });

  it('unlockedPoints sums tier points and ignores unknown ids', () => {
    const pts = unlockedPoints(['wave-climber-1', 'wave-climber-2', 'bogus']);
    expect(pts).toBe(TIER_BY_ID['wave-climber-1'].points + TIER_BY_ID['wave-climber-2'].points);
  });

  it('bestUnlock returns the highest-point owned tier', () => {
    const best = bestUnlock(['wave-climber-1', 'arsenal', 'first-blood']);
    expect(best.tierId).toBe('arsenal');
    expect(bestUnlock([])).toBeNull();
  });

  it('playerLevel grows every pointsPerLevel points', () => {
    expect(playerLevel(0, 100)).toBe(1);
    expect(playerLevel(99, 100)).toBe(1);
    expect(playerLevel(100, 100)).toBe(2);
    expect(playerLevel(250, 100)).toBe(3);
  });
});
