import { CFG } from './config.js';

const KEY = 'arenaFight.save.v1';
const BACKUP_KEY = 'arenaFight.save.backup';

// Bump whenever the persisted schema changes and add a matching MIGRATIONS entry.
const CURRENT_VERSION = 4;

const DEFAULTS = () => ({
  version: CURRENT_VERSION,
  wallet: 0,
  ownedWeapons: ['pistol'],
  ownedMods: [],
  loadout: { weapon: 'pistol', weapons: ['pistol', null], mods: [null, null] },
  settings: {
    backgroundId: 'meadow',
    musicEnabled: true,
    musicVolume: 0.55,
    sfxEnabled: true,
    sfxVolume: 0.75,
    touchControls: 'auto',
    fullscreen: false,
  },
  stats: {
    runsPlayed: 0,
    bestWave: 0,
    bestScore: 0,
    totalCoinsEarned: 0,
    bestCombo: 0,
    totalKills: 0,
    bossesDefeated: 0,
  },
  achievements: [],
  // Run-continuation progress. A checkpoint is the highest boss wave the player
  // has cleared; the next run can start at checkpointWave + 1 instead of wave 1.
  // Monotonic — see setCheckpointWave().
  progress: {
    checkpointWave: 0, // highest boss wave cleared (0 = none)
  },
  // Onboarding: records that the interactive tutorial has been started. The
  // tutorial is launched only from the menu's TUTORIAL button (no auto-launch).
  tutorialSeen: false,
});

// Ordered migration pipeline. Each entry maps a state at version N to version
// N+1. Keep them pure and idempotent; the post-migration deep-merge against
// DEFAULTS backfills any key a migration omits.
const MIGRATIONS = {
  // v1 -> v2: collapse the legacy single-weapon loadout into the two-slot
  // `weapons` array (was previously an untracked in-place migration).
  1: (s) => {
    const loadout = { ...(s.loadout || {}) };
    const weaponsArr =
      Array.isArray(loadout.weapons) && loadout.weapons.length
        ? loadout.weapons
        : [loadout.weapon || 'pistol', null];
    const weapons = [weaponsArr[0] || 'pistol', weaponsArr[1] || null];
    return { ...s, version: 2, loadout: { ...loadout, weapons, weapon: weapons[0] } };
  },
  // v2 -> v3: introduce the `progress` block (boss checkpoints). The
  // deep-merge against DEFAULTS backfills `progress.checkpointWave`, so this is
  // a version-stamp-only step.
  2: (s) => ({ ...s, version: 3 }),
  // v3 -> v4: migrate the flat boolean achievement ids to the tiered scheme.
  // Tiered unlocks are recomputed from the persisted cumulative stats (which
  // survive), and legacy boolean ids are remapped so no earned badge is lost.
  // Thresholds are inlined (frozen) and must match src/achievements.js tiers.
  3: (s) => {
    const old = new Set(s.achievements || []);
    const stats = s.stats || {};
    const next = new Set();

    // Boolean achievements that kept their id across the schema change.
    for (const id of ['first-blood', 'sharpshooter', 'untouchable', 'arsenal']) {
      if (old.has(id)) next.add(id);
    }

    // Recompute tiered unlocks from lifetime stats.
    const addTiers = (base, value, targets) => {
      targets.forEach((t, i) => {
        if ((value || 0) >= t) next.add(`${base}-${i + 1}`);
      });
    };
    addTiers('wave-climber', stats.bestWave, [10, 25, 70, 100]);
    addTiers('slayer', stats.totalKills, [100, 500, 5000, 50000]);
    addTiers('treasure', stats.totalCoinsEarned, [1000, 5000, 50000, 500000]);
    addTiers('boss-hunter', stats.bossesDefeated, [1, 5, 30, 150]);
    addTiers('combo', stats.bestCombo, [5, 8, 16, 50]);

    // Safety net: remap legacy single-shot ids for saves whose cumulative
    // counters predate the stat (so the stat is 0 but the badge was earned).
    if (old.has('boss-slayer')) next.add('boss-hunter-1');
    if (old.has('wave-10')) next.add('wave-climber-1');
    if (old.has('wave-20')) next.add('wave-climber-1');
    if (old.has('wave-50')) {
      // Old "reached wave 50" no longer clears the harder Gold tier (wave 70).
      next.add('wave-climber-1');
      next.add('wave-climber-2');
    }
    if (old.has('combo-master')) {
      next.add('combo-1');
      next.add('combo-2');
    }

    return { ...s, version: 4, achievements: [...next] };
  },
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Recursively backfill missing keys from `defaults`, preferring stored values.
function mergeDefaults(defaults, value) {
  if (Array.isArray(defaults)) {
    return Array.isArray(value) ? value : defaults;
  }
  if (isPlainObject(defaults)) {
    const out = { ...defaults };
    if (isPlainObject(value)) {
      for (const k of Object.keys(value)) {
        out[k] = k in defaults ? mergeDefaults(defaults[k], value[k]) : value[k];
      }
    }
    return out;
  }
  return value === undefined ? defaults : value;
}

let cache = null;
// Set by read() when migrations ran, so get() can persist the upgraded save.
let needsPersist = false;

function read() {
  needsPersist = false;
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    console.warn('[save] read failed, using defaults', e);
    return DEFAULTS();
  }
  if (!raw) return DEFAULTS();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn('[save] corrupt save, resetting', e);
    return DEFAULTS();
  }
  if (!isPlainObject(parsed)) {
    console.warn('[save] unexpected save shape, resetting');
    return DEFAULTS();
  }

  // Missing/invalid version is treated as the earliest schema (v1).
  let version = Number.isInteger(parsed.version) ? parsed.version : 1;
  if (version > CURRENT_VERSION) {
    console.warn('[save] save is from a newer version, resetting');
    return DEFAULTS();
  }
  if (version === CURRENT_VERSION) {
    return mergeDefaults(DEFAULTS(), parsed);
  }

  // Back up the raw bytes before mutating so a failed migration is recoverable.
  try {
    localStorage.setItem(BACKUP_KEY, raw);
  } catch {
    // Backup is best-effort; continue even if storage is full.
  }

  let state = parsed;
  try {
    while (version < CURRENT_VERSION) {
      const migrate = MIGRATIONS[version];
      if (typeof migrate !== 'function') {
        console.warn(`[save] no migration for version ${version}, resetting`);
        return DEFAULTS();
      }
      state = migrate(state);
      version = Number.isInteger(state?.version) ? state.version : version + 1;
    }
  } catch (e) {
    console.warn('[save] migration failed, resetting (backup retained)', e);
    return DEFAULTS();
  }

  needsPersist = true;
  return mergeDefaults(DEFAULTS(), state);
}

function write(state) {
  cache = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[save] write failed', e);
  }
}

export const Save = {
  get() {
    if (!cache) {
      cache = read();
      // Persist immediately after an upgrade so migrations don't re-run on
      // every load (and the backup stays in sync with the live save).
      if (needsPersist) {
        needsPersist = false;
        write(cache);
      }
    }
    return cache;
  },
  set(updater) {
    const prev = this.get();
    const next = typeof updater === 'function' ? updater(prev) : updater;
    write(next);
    return next;
  },
  addToWallet(amount) {
    return this.set((s) => ({ ...s, wallet: s.wallet + amount }));
  },
  buyWeapon(id, price) {
    return this.set((s) => {
      if (s.ownedWeapons.includes(id)) return s;
      if (s.wallet < price) return s;
      return { ...s, wallet: s.wallet - price, ownedWeapons: [...s.ownedWeapons, id] };
    });
  },
  buyMod(id, price) {
    return this.set((s) => {
      if (s.ownedMods.includes(id)) return s;
      if (s.wallet < price) return s;
      return { ...s, wallet: s.wallet - price, ownedMods: [...s.ownedMods, id] };
    });
  },
  setLoadout(weapons, mods) {
    const arr = Array.isArray(weapons) ? weapons : [weapons, null];
    const primary = arr[0] || 'pistol';
    const secondary = arr[1] || null;
    return this.set((s) => ({
      ...s,
      loadout: { weapon: primary, weapons: [primary, secondary], mods: [...mods] },
    }));
  },
  setBackground(backgroundId) {
    return this.set((s) => ({
      ...s,
      settings: { ...(s.settings || {}), backgroundId },
    }));
  },
  setMusicEnabled(musicEnabled) {
    return this.set((s) => ({
      ...s,
      settings: { ...(s.settings || {}), musicEnabled },
    }));
  },
  setMusicVolume(musicVolume) {
    return this.set((s) => ({
      ...s,
      settings: { ...(s.settings || {}), musicVolume },
    }));
  },
  setSfxEnabled(sfxEnabled) {
    return this.set((s) => ({
      ...s,
      settings: { ...(s.settings || {}), sfxEnabled },
    }));
  },
  setSfxVolume(sfxVolume) {
    return this.set((s) => ({
      ...s,
      settings: { ...(s.settings || {}), sfxVolume },
    }));
  },
  setTouchControls(touchControls) {
    return this.set((s) => ({
      ...s,
      settings: { ...(s.settings || {}), touchControls },
    }));
  },
  setFullscreen(fullscreen) {
    return this.set((s) => ({
      ...s,
      settings: { ...(s.settings || {}), fullscreen },
    }));
  },
  markTutorialSeen() {
    return this.set((s) => (s.tutorialSeen ? s : { ...s, tutorialSeen: true }));
  },
  resetTutorial() {
    return this.set((s) => ({ ...s, tutorialSeen: false }));
  },
  recordRun({
    wave,
    score,
    coinsEarned,
    persistCoins = true,
    longestCombo = 0,
    kills = 0,
    bosses = 0,
  }) {
    return this.set((s) => ({
      ...s,
      wallet: persistCoins ? s.wallet + coinsEarned : s.wallet,
      stats: {
        ...s.stats,
        runsPlayed: s.stats.runsPlayed + 1,
        bestWave: Math.max(s.stats.bestWave, wave),
        bestScore: Math.max(s.stats.bestScore, score),
        totalCoinsEarned: s.stats.totalCoinsEarned + coinsEarned,
        bestCombo: Math.max(s.stats.bestCombo || 0, longestCombo),
        totalKills: (s.stats.totalKills || 0) + kills,
        bossesDefeated: (s.stats.bossesDefeated || 0) + bosses,
      },
    }));
  },
  // Highest boss wave cleared (0 = none). Continue starts at this + 1.
  getCheckpointWave() {
    return this.get().progress?.checkpointWave || 0;
  },
  // Record a cleared boss wave. Monotonic (never decreases) and only accepts a
  // genuine boss wave, capped at the final boss so the post-100 climb stays a
  // fresh endurance run. Ignores non-boss / lower / invalid waves.
  setCheckpointWave(wave) {
    const every = CFG.boss.everyNWaves;
    if (!Number.isInteger(wave) || every <= 0 || wave % every !== 0) return this.get();
    const capped = Math.min(wave, CFG.boss.finalWave);
    return this.set((s) => {
      const current = s.progress?.checkpointWave || 0;
      if (capped <= current) return s;
      return { ...s, progress: { ...(s.progress || {}), checkpointWave: capped } };
    });
  },
  resetCheckpoint() {
    return this.set((s) => ({
      ...s,
      progress: { ...(s.progress || {}), checkpointWave: 0 },
    }));
  },
  unlockAchievements(ids) {
    const toAdd = Array.isArray(ids) ? ids : [ids];
    return this.set((s) => {
      const set = new Set(s.achievements || []);
      for (const id of toAdd) set.add(id);
      return { ...s, achievements: [...set] };
    });
  },
  reset() {
    cache = DEFAULTS();
    write(cache);
    return cache;
  },
  _clearCache() {
    cache = null;
  },
};
