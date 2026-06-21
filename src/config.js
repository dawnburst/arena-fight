export const CFG = {
  player: {
    speed: 220,
    hp: 3,
    radius: 14,
    color: 0x4fc3f7,
    fireRateMs: 500,
    dashSpeed: 600,
    dashDurationMs: 150,
    dashCooldownMs: 800,
    hitFlashMs: 200,
    phoenixBlastRadius: 150, // Phoenix revive: blast radius that clears nearby enemies
    phoenixBlastDamage: 99, // high enough to destroy any non-boss enemy
    weaponSwapDelayMs: 500, // cannot fire for this long after switching weapons
  },
  // Top-left HUD HP indicator. HP is rendered as discrete pips (one per max HP)
  // instead of "HP: N/M" text so it reads at a glance mid-fight. A lost pip
  // flashes before going dim. Pip count is dynamic (mods change runtime.maxHp).
  hud: {
    hpPips: {
      size: 16, // heart icon width/height in px
      gap: 18, // center-to-center spacing between pips
      y: 16, // center y of the pip row (clears the score row at y=28)
      fillColor: 0xff5252, // tint for both filled hearts and the empty outline
      flashColor: 0xffffff, // bright pop on the just-lost heart
      flashMs: 220,
    },
  },
  bullet: {
    speed: 520,
    radius: 4,
    color: 0x37474f,
    lifetimeMs: 1200,
  },
  enemy: {
    speed: 60,
    hp: 1,
    radius: 12,
    color: 0xe53935,
    contactDamage: 1,
  },
  dasher: {
    color: 0x2e7d32,
    radius: 12,
    hp: 1,
    contactDamage: 1,
    walkSpeedFactor: 0.5,
    dashSpeed: 600,
    dashDurationMs: 150,
    dashCooldownMinMs: 3000,
    dashCooldownMaxMs: 5000,
    windupMs: 400,
    windupFlashMs: 80,
    appearFromWave: 55,
    spawnRatio: 0.25,
  },
  firecaster: {
    color: 0xff7043,
    radius: 12,
    hp: 1,
    contactDamage: 1,
    speed: 52,
    minRange: 135,
    preferredRange: 230,
    maxRange: 310,
    strafeSpeed: 44,
    windupMs: 350,
    windupFlashMs: 70,
    fireCooldownMinMs: 1300,
    fireCooldownMaxMs: 1800,
    appearFromWave: 15,
    spawnRatio: 0.18,
    maxAlive: 3,
  },
  tank: {
    radius: 18,
    hp: 8,
    contactDamage: 1,
    speed: 34,
    appearFromWave: 10,
    spawnRatio: 0.12,
    maxAlive: 4,
  },
  splitter: {
    radius: 13,
    hp: 2,
    contactDamage: 1,
    speed: 72,
    appearFromWave: 20,
    spawnRatio: 0.13,
    maxAlive: 5,
    childCount: 3,
    childHp: 1,
    childRadius: 8,
    childSpeed: 120,
  },
  bomber: {
    radius: 13,
    hp: 2,
    contactDamage: 1,
    speed: 60,
    appearFromWave: 25,
    spawnRatio: 0.12,
    maxAlive: 4,
    triggerRadius: 44,
    explosionRadius: 78,
    explosionDamage: 1,
    windupMs: 420,
    flashMs: 70,
  },
  healer: {
    radius: 12,
    hp: 2,
    contactDamage: 1,
    speed: 48,
    minRange: 175,
    healRadius: 125,
    healAmount: 1,
    healCooldownMs: 2800,
    appearFromWave: 45,
    spawnRatio: 0.1,
    maxAlive: 2,
  },
  summoner: {
    radius: 12,
    hp: 2,
    contactDamage: 1,
    speed: 44,
    minRange: 190,
    summonCooldownMs: 3600,
    summonCount: 2,
    maxMinionsAlive: 4, // a summoner won't add minions past this many splitter-children alive
    appearFromWave: 50,
    spawnRatio: 0.1,
    maxAlive: 2,
  },
  shielded: {
    radius: 14,
    hp: 3,
    contactDamage: 1,
    speed: 48,
    frontDamageMult: 0.25,
    appearFromWave: 65,
    spawnRatio: 0.12,
    maxAlive: 4,
  },
  teleporter: {
    radius: 12,
    hp: 2,
    contactDamage: 1,
    speed: 64,
    blinkCooldownMs: 3400,
    windupMs: 460,
    blinkMinDistance: 95,
    blinkMaxDistance: 150,
    appearFromWave: 70,
    spawnRatio: 0.1,
    maxAlive: 3,
  },
  sniper: {
    radius: 12,
    hp: 2,
    contactDamage: 1,
    speed: 42,
    minRange: 250,
    maxRange: 440,
    aimMs: 850,
    cooldownMs: 2600,
    shotSpeed: 520,
    shotRadius: 4,
    shotDamage: 1,
    shotLifetimeMs: 1800,
    appearFromWave: 75,
    spawnRatio: 0.09,
    maxAlive: 2,
  },
  egg: {
    radius: 16,
    hp: 5,
    contactDamage: 1,
    hatchCooldownMs: 3200,
    hatchCount: 2,
    appearFromWave: 35,
    spawnRatio: 0.09,
    maxAlive: 3,
  },
  slime: {
    radius: 13,
    hp: 2,
    contactDamage: 1,
    speed: 42,
    puddleCooldownMs: 1400,
    puddleRadius: 34,
    puddleDamage: 1,
    puddleLifetimeMs: 4200,
    appearFromWave: 40,
    spawnRatio: 0.12,
    maxAlive: 4,
  },
  enemyFireball: {
    radius: 6,
    color: 0xff8a00,
    coreColor: 0xfff176,
    speed: 230,
    damage: 1,
    lifetimeMs: 2600,
  },
  boss: {
    everyNWaves: 10, // boss appears on waves 10, 20, 30, ...
    finalWave: 100, // The Annihilator (final boss) appears here; beyond it repeats, harder
    radius: 46, // visual body radius (large)
    hitRadius: 66, // physics overlap radius; covers the orbiting weak points
    contactDamage: 1,
    shieldColor: 0x40c4ff,
    anchorY: 185, // resting height: low enough that a phase-1 boss clears the HP bar
    edgeMargin: 90, // keeps the tracked target x inside the arena
    shadowMs: 1500, // harmless shadow telegraph shown before the boss materializes
    introMs: 1200, // entrance / first-attack delay
    transitionMs: 700, // per-phase telegraph window (boss invulnerable-ish, idle)
    pierceHitCooldownMs: 120, // throttles piercing bullets re-hitting the big body
    clearAddsOnBossDeath: true, // boss death clears remaining summoned minions

    // Difficulty scales with tier (tier = wave / everyNWaves; 1 at wave 10 .. 10 at wave 100).
    baseHp: 90,
    hpPerTier: 75, // + per subsequent boss appearance
    baseShield: 45,
    shieldPerTier: 30,
    cadenceScalePerTier: 0.05, // attack cooldowns shrink with tier ...
    cadenceScaleMin: 0.45, // ... down to this floor
    projSpeedPerTier: 14, // projectiles get faster with tier
    moveSpeedPerTier: 4,
    orbitSpeedPerTier: 8,

    phaseThresholds: [0.66, 0.33], // enter phase 2 below 66% hp, phase 3 below 33%
    phaseMoveSpeed: [28, 42, 56], // by phase index
    phaseOrbitSpeed: [55, 95, 140], // deg/s by phase index
    phaseCadenceScale: [1, 0.8, 0.62], // later phases attack faster

    weakPoint: {
      orbitRadius: 58,
      nodeRadius: 6, // visual size
      hitRadius: 8, // small => skill shortcut; bullets here bypass the shield
      color: 0xffeb3b,
      damageMult: 2.5, // weak-point hits deal extra HP damage
    },

    // Move / "weapon" library. Cooldowns are scaled by tier and current phase.
    powers: {
      summon: { cooldownMs: 6000, count: 3, maxAdds: 9, glow: 0xab47bc },
      barrage: { cooldownMs: 4200, count: 9, radius: 7, speed: 240, lifetimeMs: 3000, damage: 1 },
      spiral: {
        cooldownMs: 2600,
        count: 5,
        stepDeg: 26,
        radius: 6,
        speed: 235,
        lifetimeMs: 3200,
        damage: 1,
      },
      aimedVolley: {
        cooldownMs: 3200,
        count: 5,
        spreadDeg: 24,
        radius: 6,
        speed: 320,
        lifetimeMs: 2600,
        damage: 1,
      },
      charge: {
        cooldownMs: 6500,
        windupMs: 500,
        speed: 540,
        durationMs: 650,
        slamRadius: 120,
        slamDamage: 1,
      },
      nova: { cooldownMs: 5200, radius: 150, damage: 1, windupMs: 430 },
      // Hexweaver kit (one per phase).
      beamSweep: {
        cooldownMs: 4200,
        beams: 3,
        durationMs: 3000,
        sweepDegPerSec: 60,
        hitWidth: 16,
        damage: 1,
      },
      mirrorClones: {
        cooldownMs: 6500,
        count: 2,
        lifetimeMs: 6000,
        fireCooldownMs: 1400,
        radius: 26,
      },
      gravityWell: {
        cooldownMs: 5500,
        durationMs: 3000,
        pullSpeed: 130,
        damageRadius: 36,
        damage: 1,
        radius: 150,
      },
      // Phantom phase-3 red-dot field.
      dotField: {
        cooldownMs: 2600,
        count: 4,
        spread: 90,
        telegraphMs: 1000,
        activeMs: 500,
        radius: 26,
        damage: 1,
      },
      // Overlord homing missiles (replaces summon).
      missiles: {
        cooldownMs: 3200,
        count: 3,
        speed: 170,
        turnDegPerSec: 180,
        radius: 7,
        lifetimeMs: 6000,
        damage: 1,
      },
      shieldSlam: { cooldownMs: 9000 },
    },

    reward: {
      baseCoins: 350,
      coinsPerTier: 100, // big-coin value = baseCoins + coinsPerTier * (tier - 1)
    },
    bar: {
      x: 400,
      // Bar rides high, just under the coins counter, so a phase-1 boss spawning
      // below it is never hidden. Name label sits just below the bar.
      y: 44,
      nameY: 66,
      width: 560,
      height: 16,
    },

    // One archetype per boss wave (index 0 = wave 10 ... index 9 = wave 100 final).
    // Each has distinct colours, weak-point counts, and a per-phase power set, so
    // every boss fights differently. Difficulty also scales continuously by tier.
    variants: [
      {
        id: 'warden',
        name: 'The Warden',
        body: 0x4a148c,
        accent: 0x9575cd,
        core: 0xff5252,
        proj: 0xb388ff,
        weakPointsByPhase: [2, 2, 3],
        phasePowers: [['summon'], ['summon', 'barrage'], ['summon', 'barrage']],
      },
      {
        id: 'juggernaut',
        name: 'The Juggernaut',
        body: 0x1b5e20,
        accent: 0x66bb6a,
        core: 0xffee58,
        proj: 0x9ccc65,
        weakPointsByPhase: [2, 2, 3],
        phasePowers: [['barrage'], ['barrage', 'charge'], ['barrage', 'charge']],
      },
      {
        id: 'hexweaver',
        name: 'The Hexweaver',
        body: 0x0d47a1,
        accent: 0x42a5f5,
        core: 0x80d8ff,
        proj: 0x64b5f6,
        weakPointsByPhase: [2, 3, 3],
        // Unique kit, one ability per phase (no overlap with other bosses).
        phasePowers: [['beamSweep'], ['mirrorClones'], ['gravityWell']],
      },
      {
        id: 'bombardier',
        name: 'The Bombardier',
        body: 0xbf360c,
        accent: 0xff8a65,
        core: 0xffd54f,
        proj: 0xff7043,
        weakPointsByPhase: [2, 2, 3],
        phasePowers: [
          ['aimedVolley'],
          ['aimedVolley', 'barrage'],
          ['aimedVolley', 'barrage', 'charge'],
        ],
      },
      {
        name: 'The Phantom',
        body: 0x004d40,
        accent: 0x4db6ac,
        core: 0xb2ff59,
        proj: 0x1de9b6,
        weakPointsByPhase: [3, 3, 3],
        phasePowers: [
          ['barrage', 'nova'],
          ['barrage', 'nova'],
          ['barrage', 'nova', 'charge', 'dotField'],
        ],
      },
      {
        name: 'The Overlord',
        body: 0xb71c1c,
        accent: 0xef5350,
        core: 0xffca28,
        proj: 0xff5252,
        weakPointsByPhase: [2, 3, 3],
        // Summons homing missiles instead of enemies.
        phasePowers: [
          ['missiles', 'barrage'],
          ['missiles', 'barrage', 'charge'],
          ['missiles', 'barrage', 'charge', 'nova'],
        ],
      },
      {
        name: 'The Tempest',
        body: 0x006064,
        accent: 0x26c6da,
        core: 0xe0f7fa,
        proj: 0x00e5ff,
        weakPointsByPhase: [3, 3, 4],
        phasePowers: [
          ['spiral', 'aimedVolley'],
          ['spiral', 'aimedVolley', 'charge'],
          ['spiral', 'aimedVolley', 'charge', 'nova'],
        ],
      },
      {
        name: 'The Colossus',
        body: 0x37474f,
        accent: 0x90a4ae,
        core: 0xff8a65,
        proj: 0xb0bec5,
        weakPointsByPhase: [2, 3, 4],
        phasePowers: [
          ['charge', 'barrage'],
          ['charge', 'barrage', 'shieldSlam'],
          ['charge', 'barrage', 'shieldSlam', 'spiral'],
        ],
      },
      {
        name: 'The Voidcaller',
        body: 0x4a0072,
        accent: 0xce93d8,
        core: 0xea80fc,
        proj: 0xe040fb,
        weakPointsByPhase: [3, 3, 4],
        phasePowers: [
          ['spiral', 'summon', 'nova'],
          ['spiral', 'summon', 'nova', 'aimedVolley'],
          ['spiral', 'summon', 'nova', 'aimedVolley', 'charge'],
        ],
      },
      {
        name: 'The Annihilator',
        body: 0x311b92,
        accent: 0xffd740,
        core: 0xff1744,
        proj: 0xffea00,
        weakPointsByPhase: [3, 4, 4],
        phasePowers: [
          ['barrage', 'spiral', 'aimedVolley'],
          ['barrage', 'spiral', 'aimedVolley', 'charge', 'summon'],
          ['barrage', 'spiral', 'aimedVolley', 'charge', 'summon', 'nova', 'shieldSlam'],
        ],
      },
    ],
  },
  waves: {
    baseCount: 5,
    growthPerWave: 3,
    spawnIntervalMs: 600,
    interWaveDelayMs: 1500,
    enemySpeedGrowth: 4,
    speedCapWave: 15, // enemy speed stops increasing past this wave (bosses unaffected)
  },
  combo: {
    resetMs: 2500,
    maxMultiplier: 8,
    scorePerKillBase: 100,
  },
  // In-game pause menu (GameScene.buildPauseMenu): Resume / Restart / Settings /
  // Quit, navigable by keyboard, mouse, and touch.
  pause: {
    buttonWidth: 240,
    buttonHeight: 46,
    buttonGap: 14,
    titleOffsetY: -150, // title center-y relative to canvas center
    firstButtonOffsetY: -68, // first button top relative to canvas center
    backdropAlpha: 0.66,
    depth: 1400,
    accent: 0x69f0ae, // selected caret / border accent (matches menu START)
  },
  arena: {
    width: 800,
    height: 600,
  },
  coin: {
    radius: 4,
    bigRadius: 13, // large boss-reward coin (carries a value > 1)
    color: 0xffd54f,
    dropSpeed: 60,
    magnetRadius: 180,
    magnetSpeed: 430,
    gravityRadiusMult: 1.7,
    gravitySpeed: 90,
    gravityTurn: 0.045,
    magnetTurn: 0.18,
    drag: 0.9,
    maxSpeed: 520,
    lifetimeMs: 5000, // small kill-drop coins despawn after this if uncollected
    warnLastMs: 1200, // blink the coin during the last part of its life before despawn
  },
  store: {
    waveClearBase: 25,
    waveClearPerWave: 10,
    coinDropPerKillBase: 1,
  },
  gift: {
    spawnDelayMinMs: 45000,
    spawnDelayMaxMs: 90000,
    lifetimeMs: 6000,
    warnLastMs: 1500,
    radius: 13,
    color: 0xff80ab,
    edgePadding: 60,
    durationMs: 30000,
  },
  shieldBonus: {
    spawnDelayMinMs: 60000,
    spawnDelayMaxMs: 120000,
    lifetimeMs: 6000,
    warnLastMs: 1500,
    outerRadius: 14,
    innerRadius: 6,
    color: 0xffd54f,
    edgePadding: 60,
    durationMs: 20000,
    maxHits: 5,
    coinsPerUnusedHit: 30, // coins awarded per unused hit when a pickup shield ends
    ringColor: 0xffd54f,
    ringWidth: 3,
    ringRadiusPad: 6,
  },
};
