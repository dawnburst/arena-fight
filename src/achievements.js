import { assetPath } from './assetPath.js';
import { WEAPONS } from './catalog.js';

// Tiered, points-based achievements.
//
// An achievement is either:
//   - tiered:  has `tiers` (ascending targets) + `progress(ctx)` returning a
//              cumulative numeric value compared against each target. Each tier is
//              its own unlockable id (`<id>-1` … `<id>-4`).
//   - boolean: has `check(ctx)` (and `points`). A single unlockable id (`<id>`).
//
// `check`/`progress` receive:
//   ctx.run   — the run summary built in GameScene.endGame() (absent on screens)
//   ctx.stats — Save.stats AFTER this run was recorded
//   ctx.save  — the full save state (ownedWeapons, achievements, ...)

// Tier metal/points/frame colour. Index 0..3 == Bronze..Diamond.
export const TIER_META = [
  { label: 'Bronze', points: 10, color: 0xcd7f32 },
  { label: 'Silver', points: 25, color: 0xc0c0c0 },
  { label: 'Gold', points: 50, color: 0xffd24a },
  { label: 'Diamond', points: 100, color: 0x7fe7ff },
];

// Gallery category tabs (order = tab order).
export const CATEGORIES = [
  { id: 'combat', name: 'Combat' },
  { id: 'progression', name: 'Progression' },
  { id: 'mastery', name: 'Mastery' },
  { id: 'collection', name: 'Collection' },
];

export const ACHIEVEMENTS = [
  {
    id: 'wave-climber',
    name: 'Wave Climber',
    category: 'progression',
    icon: '🌊',
    // Diamond is wave 100 — the final boss / game ceiling — so Gold carries the
    // harder bump here.
    tiers: [10, 25, 70, 100],
    descriptionFor: (t) => `Reach wave ${t}.`,
    progress: (ctx) => ctx.stats?.bestWave || 0,
  },
  {
    id: 'slayer',
    name: 'Slayer',
    category: 'combat',
    icon: '💀',
    tiers: [100, 500, 5000, 50000],
    descriptionFor: (t) => `Defeat ${t.toLocaleString()} enemies in total.`,
    progress: (ctx) => ctx.stats?.totalKills || 0,
  },
  {
    id: 'treasure',
    name: 'Treasure Hoarder',
    category: 'collection',
    icon: '💰',
    tiers: [1000, 5000, 50000, 500000],
    descriptionFor: (t) => `Earn ${t.toLocaleString()} coins in total.`,
    progress: (ctx) => ctx.stats?.totalCoinsEarned || 0,
  },
  {
    id: 'boss-hunter',
    name: 'Boss Hunter',
    category: 'combat',
    icon: '👹',
    tiers: [1, 5, 30, 150],
    descriptionFor: (t) => `Defeat ${t} ${t === 1 ? 'boss' : 'bosses'} in total.`,
    progress: (ctx) => ctx.stats?.bossesDefeated || 0,
  },
  {
    id: 'combo',
    name: 'Combo Adept',
    category: 'mastery',
    icon: '🔥',
    tiers: [5, 8, 16, 50],
    descriptionFor: (t) => `Reach an x${t} combo.`,
    progress: (ctx) => ctx.stats?.bestCombo || 0,
  },
  {
    id: 'first-blood',
    name: 'First Blood',
    category: 'combat',
    icon: '🩸',
    points: 10,
    description: 'Defeat your first enemy.',
    check: (ctx) => (ctx.run?.kills || 0) >= 1 || (ctx.stats?.totalKills || 0) >= 1,
  },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    category: 'mastery',
    icon: '🎯',
    points: 50,
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
    category: 'mastery',
    icon: '🛡️',
    points: 75,
    description: 'Defeat a boss without taking damage.',
    check: (ctx) => !!ctx.run?.bossNoHit,
  },
  {
    id: 'arsenal',
    name: 'Arsenal',
    category: 'collection',
    icon: '🗡️',
    points: 100,
    description: 'Own every weapon.',
    check: (ctx) => {
      const owned = new Set(ctx.save?.ownedWeapons || []);
      return WEAPONS.every((w) => owned.has(w.id));
    },
  },
];

// Flatten every achievement into its individual unlockable tiers. Boolean
// achievements become a single tier (target 1) so all consumers (gallery,
// progress, points) can treat the set uniformly.
function buildTiers() {
  const list = [];
  for (const ach of ACHIEVEMENTS) {
    if (Array.isArray(ach.tiers)) {
      ach.tiers.forEach((target, i) => {
        const meta = TIER_META[i] || TIER_META[TIER_META.length - 1];
        list.push({
          tierId: `${ach.id}-${i + 1}`,
          achId: ach.id,
          name: ach.name,
          category: ach.category,
          icon: ach.icon,
          tierIndex: i,
          label: meta.label,
          target,
          points: meta.points,
          color: meta.color,
          description: ach.descriptionFor ? ach.descriptionFor(target) : ach.description,
        });
      });
    } else {
      list.push({
        tierId: ach.id,
        achId: ach.id,
        name: ach.name,
        category: ach.category,
        icon: ach.icon,
        tierIndex: 0,
        label: null,
        target: 1,
        points: ach.points || 10,
        color: 0xffd24a,
        description: ach.description,
      });
    }
  }
  return list;
}

export const ACHIEVEMENT_TIERS = buildTiers();
export const TIER_BY_ID = Object.fromEntries(ACHIEVEMENT_TIERS.map((t) => [t.tierId, t]));
export const ACHIEVEMENTS_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
// Number of base achievements (kept for back-compat with older callers).
export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;
// Number of individually unlockable tiers — the denominator for "X / Y unlocked".
export const ACHIEVEMENT_TIER_COUNT = ACHIEVEMENT_TIERS.length;
export const TOTAL_POINTS = ACHIEVEMENT_TIERS.reduce((sum, t) => sum + t.points, 0);

// Badge image conventions: one PNG per tier at assets/achievements/<tierId>.png.
export const achievementBadgeKey = (tierId) => `ach-badge-${tierId}`;
export const achievementBadgePath = (tierId) => assetPath(`assets/achievements/${tierId}.png`);

// Returns the ids (tier ids for tiered, base id for boolean) that now pass and
// are not yet in `unlockedIds`. Pure: callers persist the result themselves.
export function evaluateAchievements(ctx, unlockedIds = []) {
  const unlocked = new Set(unlockedIds);
  const newly = [];
  for (const ach of ACHIEVEMENTS) {
    if (Array.isArray(ach.tiers)) {
      let cur = 0;
      try {
        cur = ach.progress(ctx) || 0;
      } catch {
        cur = 0;
      }
      ach.tiers.forEach((target, i) => {
        const tierId = `${ach.id}-${i + 1}`;
        if (!unlocked.has(tierId) && cur >= target) newly.push(tierId);
      });
    } else {
      if (unlocked.has(ach.id)) continue;
      let passed = false;
      try {
        passed = !!ach.check(ctx);
      } catch {
        passed = false;
      }
      if (passed) newly.push(ach.id);
    }
  }
  return newly;
}

// Current numeric progress toward a single tier's target (clamped). Used by the
// gallery detail popup's progress bar.
export function tierProgress(ctx, tier) {
  const ach = ACHIEVEMENTS_BY_ID[tier.achId];
  let current = 0;
  try {
    if (ach && Array.isArray(ach.tiers)) current = ach.progress(ctx) || 0;
    else if (ach) current = ach.check(ctx) ? 1 : 0;
  } catch {
    current = 0;
  }
  return {
    current: Math.min(current, tier.target),
    target: tier.target,
    ratio: tier.target > 0 ? Math.min(1, current / tier.target) : 0,
  };
}

// Total achievement points the player owns.
export function unlockedPoints(unlockedIds = []) {
  let pts = 0;
  for (const id of unlockedIds) pts += TIER_BY_ID[id]?.points || 0;
  return pts;
}

// Highest-point tier the player owns (their "rarest" badge), or null.
export function bestUnlock(unlockedIds = []) {
  let best = null;
  for (const id of unlockedIds) {
    const t = TIER_BY_ID[id];
    if (!t) continue;
    if (!best || t.points > best.points) best = t;
  }
  return best;
}

// Simple points → level curve (tunable via CFG.achievements.pointsPerLevel).
export function playerLevel(points, perLevel = 100) {
  return Math.floor((points || 0) / Math.max(1, perLevel)) + 1;
}
