import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENT_COUNT,
  ACHIEVEMENTS,
  ACHIEVEMENTS_BY_ID,
  evaluateAchievements,
} from '../src/achievements.js';
import { WEAPONS } from '../src/catalog.js';

const emptyRun = {
  wave: 0,
  kills: 0,
  bosses: 0,
  longestCombo: 1,
  shotsFired: 0,
  shotsHit: 0,
  coinsEarned: 0,
  bossNoHit: false,
};

function ctx(runOverrides = {}, saveOverrides = {}) {
  return {
    run: { ...emptyRun, ...runOverrides },
    stats: {},
    save: { ownedWeapons: ['pistol'], achievements: [], ...saveOverrides },
  };
}

describe('achievements definitions', () => {
  it('every achievement has a unique id, name, description and check', () => {
    const ids = new Set();
    for (const ach of ACHIEVEMENTS) {
      expect(typeof ach.id).toBe('string');
      expect(typeof ach.name).toBe('string');
      expect(typeof ach.description).toBe('string');
      expect(typeof ach.check).toBe('function');
      expect(ids.has(ach.id)).toBe(false);
      ids.add(ach.id);
    }
    expect(ACHIEVEMENT_COUNT).toBe(ACHIEVEMENTS.length);
    expect(Object.keys(ACHIEVEMENTS_BY_ID).length).toBe(ACHIEVEMENTS.length);
  });
});

describe('individual achievement checks', () => {
  it('first-blood requires at least one kill', () => {
    expect(ACHIEVEMENTS_BY_ID['first-blood'].check(ctx({ kills: 0 }))).toBe(false);
    expect(ACHIEVEMENTS_BY_ID['first-blood'].check(ctx({ kills: 1 }))).toBe(true);
  });

  it('wave milestones fire at the right wave', () => {
    expect(ACHIEVEMENTS_BY_ID['wave-10'].check(ctx({ wave: 9 }))).toBe(false);
    expect(ACHIEVEMENTS_BY_ID['wave-10'].check(ctx({ wave: 10 }))).toBe(true);
    expect(ACHIEVEMENTS_BY_ID['wave-20'].check(ctx({ wave: 20 }))).toBe(true);
    expect(ACHIEVEMENTS_BY_ID['wave-50'].check(ctx({ wave: 49 }))).toBe(false);
    expect(ACHIEVEMENTS_BY_ID['wave-50'].check(ctx({ wave: 50 }))).toBe(true);
  });

  it('boss-slayer requires a boss kill', () => {
    expect(ACHIEVEMENTS_BY_ID['boss-slayer'].check(ctx({ bosses: 0 }))).toBe(false);
    expect(ACHIEVEMENTS_BY_ID['boss-slayer'].check(ctx({ bosses: 1 }))).toBe(true);
  });

  it('combo-master requires a x8 combo', () => {
    expect(ACHIEVEMENTS_BY_ID['combo-master'].check(ctx({ longestCombo: 7 }))).toBe(false);
    expect(ACHIEVEMENTS_BY_ID['combo-master'].check(ctx({ longestCombo: 8 }))).toBe(true);
  });

  it('sharpshooter requires 80%+ accuracy over 50+ shots', () => {
    expect(ACHIEVEMENTS_BY_ID['sharpshooter'].check(ctx({ shotsFired: 40, shotsHit: 40 }))).toBe(
      false,
    );
    expect(ACHIEVEMENTS_BY_ID['sharpshooter'].check(ctx({ shotsFired: 100, shotsHit: 79 }))).toBe(
      false,
    );
    expect(ACHIEVEMENTS_BY_ID['sharpshooter'].check(ctx({ shotsFired: 100, shotsHit: 80 }))).toBe(
      true,
    );
  });

  it('untouchable requires a no-hit boss kill', () => {
    expect(ACHIEVEMENTS_BY_ID['untouchable'].check(ctx({ bossNoHit: false }))).toBe(false);
    expect(ACHIEVEMENTS_BY_ID['untouchable'].check(ctx({ bossNoHit: true }))).toBe(true);
  });

  it('treasure-hunter requires 500+ coins in a run', () => {
    expect(ACHIEVEMENTS_BY_ID['treasure-hunter'].check(ctx({ coinsEarned: 499 }))).toBe(false);
    expect(ACHIEVEMENTS_BY_ID['treasure-hunter'].check(ctx({ coinsEarned: 500 }))).toBe(true);
  });

  it('arsenal requires owning every weapon', () => {
    const allWeapons = WEAPONS.map((w) => w.id);
    expect(ACHIEVEMENTS_BY_ID['arsenal'].check(ctx({}, { ownedWeapons: ['pistol'] }))).toBe(false);
    expect(ACHIEVEMENTS_BY_ID['arsenal'].check(ctx({}, { ownedWeapons: allWeapons }))).toBe(true);
  });
});

describe('evaluateAchievements', () => {
  it('returns only newly unlocked ids', () => {
    const newly = evaluateAchievements(ctx({ wave: 10, kills: 5 }), ['first-blood']);
    expect(newly).toContain('wave-10');
    expect(newly).not.toContain('first-blood');
  });

  it('returns nothing when no checks pass', () => {
    expect(evaluateAchievements(ctx(), [])).toEqual([]);
  });

  it('does not re-report already unlocked achievements', () => {
    const all = evaluateAchievements(ctx({ wave: 50, kills: 10, bosses: 1 }), []);
    const second = evaluateAchievements(ctx({ wave: 50, kills: 10, bosses: 1 }), all);
    expect(second).toEqual([]);
  });

  it('survives a throwing check without crashing', () => {
    expect(() => evaluateAchievements({ run: null, save: null, stats: null }, [])).not.toThrow();
  });
});
