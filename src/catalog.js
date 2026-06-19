// Item catalog. Pricing, stats, and per-item application logic.

export const TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const TIER_COLORS = {
  common: '#aaaaaa',
  uncommon: '#4caf50',
  rare: '#2196f3',
  epic: '#ab47bc',
  legendary: '#ffb300',
};

// Weapons replace the player's base fire behavior.
// fire.rateMs: ms between shots
// fire.angles: angles (deg) for bullets fired each shot
// fire.bulletMods: optional behavior flags interpreted by GameScene
// fire.burst: optional { count, intraDelayMs, cooldownMs } for salvo weapons
export const WEAPONS = [
  {
    id: 'pistol',
    name: 'Pistol',
    tier: 'common',
    price: 0,
    description: 'Default sidearm. 1 bullet, 455ms.',
    fire: { rateMs: 455, angles: [0] },
  },
  {
    id: 'burst',
    name: 'Burst',
    tier: 'common',
    price: 700,
    description: 'Three-shot salvo, then 600ms cooldown.',
    fire: { rateMs: 0, angles: [0], burst: { count: 3, intraDelayMs: 100, cooldownMs: 600 } },
  },
  {
    id: 'shotgun',
    name: 'Shotgun',
    tier: 'uncommon',
    price: 1600,
    description: '6-pellet burst in a tight ±12° cone. Short range.',
    fire: {
      rateMs: 800,
      angles: [-12, -7.2, -2.4, 2.4, 7.2, 12],
      bulletMods: { lifetimeMsOverride: 350 },
    },
  },
  {
    id: 'spread',
    name: 'Spread',
    tier: 'uncommon',
    price: 1800,
    description: '3 bullets at ±25° and 0°.',
    fire: { rateMs: 510, angles: [-25, 0, 25] },
  },
  {
    id: 'rapid',
    name: 'Rapid',
    tier: 'rare',
    price: 3200,
    description: 'Always-fast: 130ms between shots.',
    fire: { rateMs: 130, angles: [0] },
  },
  {
    id: 'sniper',
    name: 'Sniper',
    tier: 'rare',
    price: 3800,
    description: 'Fires an instant laser line that pierces every enemy in its path for 3 damage.',
    fire: { rateMs: 900, angles: [0], bulletMods: { hitscan: true, piercing: true, damage: 3 } },
  },
  {
    id: 'boomerang',
    name: 'Boomerang',
    tier: 'epic',
    price: 7200,
    description: 'Large blue boomerang that pierces. Click fire again to recall it faster.',
    fire: {
      rateMs: 700,
      angles: [0],
      bulletMods: { returningAfterMs: 500, piercing: true, boomerang: true, sizeMult: 2.2 },
    },
  },
  {
    id: 'beam',
    name: 'Beam',
    tier: 'epic',
    price: 8500,
    description: 'Continuous fast stream. (Phase 1: very fast fire rate.)',
    fire: { rateMs: 60, angles: [0], bulletMods: { speedMult: 1.4, lifetimeMsOverride: 600 } },
  },
  {
    id: 'plasma',
    name: 'Plasma Cannon',
    tier: 'legendary',
    price: 16000,
    description: 'Slow, explodes on hit (60px AOE).',
    fire: {
      rateMs: 385,
      angles: [0],
      bulletMods: { aoeRadius: 60, sizeMult: 2.5, speedMult: 0.7 },
    },
  },
  {
    id: 'twin-pulse',
    name: 'Twin Pulse',
    tier: 'legendary',
    price: 20000,
    description: 'Two bullets per shot; second curves toward nearest enemy.',
    fire: { rateMs: 250, angles: [-8, 8], bulletMods: { homingSecondShot: true } },
  },
];

// Mods are passive effects. Each has an `apply(ctx)` that mutates runtime stats.
export const MODS = [
  {
    id: 'quick-draw',
    name: 'Quick Draw',
    tier: 'common',
    price: 600,
    description: '-10% fire rate.',
    apply: (ctx) => {
      ctx.fireRateMult *= 0.9;
    },
  },
  {
    id: 'pocket-wallet',
    name: 'Pocket Wallet',
    tier: 'common',
    price: 900,
    description: '+20% coin drops.',
    apply: (ctx) => {
      ctx.coinDropMult *= 1.2;
    },
  },
  {
    id: 'stride',
    name: 'Stride',
    tier: 'common',
    price: 650,
    description: '+10% move speed.',
    apply: (ctx) => {
      ctx.moveSpeedMult *= 1.1;
    },
  },
  {
    id: 'steel-plate',
    name: 'Steel Plate',
    tier: 'uncommon',
    price: 1500,
    description: '+1 max HP.',
    apply: (ctx) => {
      ctx.maxHpDelta += 1;
    },
  },
  {
    id: 'rocket-boots',
    name: 'Rocket Boots',
    tier: 'uncommon',
    price: 1400,
    description: 'Dash 35% faster and farther.',
    apply: (ctx) => {
      ctx.dashSpeedMult *= 1.35;
    },
  },
  {
    id: 'combo-glove',
    name: 'Combo Glove',
    tier: 'rare',
    price: 3000,
    description: 'Combo decay window +1s.',
    apply: (ctx) => {
      ctx.comboResetMsDelta += 1000;
    },
  },
  {
    id: 'extra-dash',
    name: 'Extra Dash',
    tier: 'rare',
    price: 3600,
    description: 'Dash cooldown -50%.',
    apply: (ctx) => {
      ctx.dashCooldownMult *= 0.5;
    },
  },
  {
    id: 'eagle-eye',
    name: 'Eagle Eye',
    tier: 'epic',
    price: 6800,
    description: 'Bullet speed +25%, lifetime +25%.',
    apply: (ctx) => {
      ctx.bulletSpeedMult *= 1.25;
      ctx.bulletLifetimeMult *= 1.25;
    },
  },
  {
    id: 'glass-cannon',
    name: 'Glass Cannon',
    tier: 'epic',
    price: 8000,
    description: '-1 max HP, +40% fire rate.',
    apply: (ctx) => {
      ctx.maxHpDelta -= 1;
      ctx.fireRateMult *= 1 / 1.4;
    },
  },
  {
    id: 'lucky-charm',
    name: 'Lucky Charm',
    tier: 'legendary',
    price: 15000,
    description: '10% chance for double coin drops, and gifts appear 10% more often.',
    apply: (ctx) => {
      ctx.luckyChance = 0.1;
      ctx.giftRateMult *= 0.9; // shorter gift spawn delay => more frequent gifts
    },
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    tier: 'legendary',
    price: 18000,
    description: 'Revive once per run: a blast destroys nearby enemies, plus a 20s shield.',
    apply: (ctx) => {
      ctx.phoenixCharges += 1;
    },
  },
];

const BY_ID = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
export const WEAPONS_BY_ID = BY_ID(WEAPONS);
export const MODS_BY_ID = BY_ID(MODS);

export function getWeapon(id) {
  return WEAPONS_BY_ID[id] || WEAPONS_BY_ID.pistol;
}

export function getMod(id) {
  if (!id) return null;
  return MODS_BY_ID[id] || null;
}

// Build a runtime stats bundle by applying all equipped mods.
export function buildRuntimeStats(modIds) {
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
    giftRateMult: 1,
    phoenixCharges: 0,
  };
  for (const id of modIds || []) {
    const mod = getMod(id);
    if (mod?.apply) mod.apply(ctx);
  }
  return ctx;
}
