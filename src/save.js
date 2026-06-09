const KEY = 'arenaFight.save.v1';

const DEFAULTS = () => ({
  version: 1,
  wallet: 0,
  ownedWeapons: ['pistol'],
  ownedMods: [],
  loadout: { weapon: 'pistol', mods: [null, null] },
  settings: { backgroundId: 'meadow' },
  stats: { runsPlayed: 0, bestWave: 0, bestScore: 0, totalCoinsEarned: 0 },
});

let cache = null;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) {
      console.warn('[save] unknown schema version, resetting');
      return DEFAULTS();
    }
    const base = DEFAULTS();
    return {
      ...base,
      ...parsed,
      loadout: { ...base.loadout, ...(parsed.loadout || {}) },
      settings: { ...base.settings, ...(parsed.settings || {}) },
      stats: { ...base.stats, ...(parsed.stats || {}) },
      ownedWeapons: Array.isArray(parsed.ownedWeapons) ? parsed.ownedWeapons : base.ownedWeapons,
      ownedMods: Array.isArray(parsed.ownedMods) ? parsed.ownedMods : base.ownedMods,
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
  setLoadout(weapon, mods) {
    return this.set((s) => ({ ...s, loadout: { weapon, mods: [...mods] } }));
  },
  setBackground(backgroundId) {
    return this.set((s) => ({
      ...s,
      settings: { ...(s.settings || {}), backgroundId },
    }));
  },
  recordRun({ wave, score, coinsEarned, persistCoins = true }) {
    return this.set((s) => ({
      ...s,
      wallet: persistCoins ? s.wallet + coinsEarned : s.wallet,
      stats: {
        runsPlayed: s.stats.runsPlayed + 1,
        bestWave: Math.max(s.stats.bestWave, wave),
        bestScore: Math.max(s.stats.bestScore, score),
        totalCoinsEarned: s.stats.totalCoinsEarned + coinsEarned,
      },
    }));
  },
  reset() {
    cache = DEFAULTS();
    write(cache);
    return cache;
  },
};
