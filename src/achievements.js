import { WEAPONS } from './catalog.js';

// Data-driven achievement definitions. Each `check(ctx)` receives:
//   ctx.run   — the run summary built in GameScene.endGame()
//   ctx.stats — Save.stats AFTER this run was recorded
//   ctx.save  — the full save state (ownedWeapons, achievements, ...)
// Adding a new achievement is just another entry in this array.
export const ACHIEVEMENTS = [
  {
    id: 'first-blood',
    name: 'First Blood',
    description: 'Defeat your first enemy.',
    check: (ctx) => (ctx.run?.kills || 0) >= 1,
  },
  {
    id: 'wave-10',
    name: 'Double Digits',
    description: 'Reach wave 10.',
    check: (ctx) => (ctx.run?.wave || 0) >= 10,
  },
  {
    id: 'wave-20',
    name: 'Survivor',
    description: 'Reach wave 20.',
    check: (ctx) => (ctx.run?.wave || 0) >= 20,
  },
  {
    id: 'wave-50',
    name: 'Veteran',
    description: 'Reach wave 50.',
    check: (ctx) => (ctx.run?.wave || 0) >= 50,
  },
  {
    id: 'boss-slayer',
    name: 'Boss Slayer',
    description: 'Defeat a boss.',
    check: (ctx) => (ctx.run?.bosses || 0) >= 1,
  },
  {
    id: 'combo-master',
    name: 'Combo Master',
    description: 'Reach a x8 combo.',
    check: (ctx) => (ctx.run?.longestCombo || 0) >= 8,
  },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description: 'Finish a run with 80%+ accuracy (50+ shots).',
    check: (ctx) => {
      const fired = ctx.run?.shotsFired || 0;
      const hit = ctx.run?.shotsHit || 0;
      return fired >= 50 && hit / fired >= 0.8;
    },
  },
  {
    id: 'untouchable',
    name: 'Untouchable',
    description: 'Defeat a boss without taking damage.',
    check: (ctx) => !!ctx.run?.bossNoHit,
  },
  {
    id: 'treasure-hunter',
    name: 'Treasure Hunter',
    description: 'Earn 500+ coins in a single run.',
    check: (ctx) => (ctx.run?.coinsEarned || 0) >= 500,
  },
  {
    id: 'arsenal',
    name: 'Arsenal',
    description: 'Own every weapon.',
    check: (ctx) => {
      const owned = new Set(ctx.save?.ownedWeapons || []);
      return WEAPONS.every((w) => owned.has(w.id));
    },
  },
];

export const ACHIEVEMENTS_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

// Returns the ids of achievements whose check now passes and that are not yet
// in `unlockedIds`. Pure: callers persist the result themselves.
export function evaluateAchievements(ctx, unlockedIds = []) {
  const unlocked = new Set(unlockedIds);
  const newly = [];
  for (const ach of ACHIEVEMENTS) {
    if (unlocked.has(ach.id)) continue;
    let passed = false;
    try {
      passed = !!ach.check(ctx);
    } catch {
      passed = false;
    }
    if (passed) newly.push(ach.id);
  }
  return newly;
}
