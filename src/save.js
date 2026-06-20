const KEY = 'arenaFight.save.v1';

const DEFAULTS = () => ({
  version: 1,
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
});

let cache = null;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS();
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) {
      console.warn('[save] unknown schema version, resetting');
      return DEFAULTS();
    }
    const base = DEFAULTS();
    const loadout = { ...base.loadout, ...(parsed.loadout || {}) };
    // Migrate single-weapon saves to the two-slot weapons array.
    const weaponsArr =
      Array.isArray(loadout.weapons) && loadout.weapons.length
        ? loadout.weapons
        : [loadout.weapon || 'pistol', null];
    loadout.weapons = [weaponsArr[0] || 'pistol', weaponsArr[1] || null];
    loadout.weapon = loadout.weapons[0];
    return {
      ...base,
      ...parsed,
      loadout,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      stats: { ...base.stats, ...(parsed.stats || {}) },
      ownedWeapons: Array.isArray(parsed.ownedWeapons) ? parsed.ownedWeapons : base.ownedWeapons,
      ownedMods: Array.isArray(parsed.ownedMods) ? parsed.ownedMods : base.ownedMods,
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : base.achievements,
    };
  } catch (e) {
    console.warn('[save] corrupt save, resetting', e);
    return DEFAULTS();
  }
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
    if (!cache) cache = read();
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
