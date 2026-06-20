import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Save } from '../src/save.js';

describe('save', () => {
  beforeEach(() => {
    localStorage.clear();
    Save._clearCache();
  });

  it('get should return default state when storage is empty', () => {
    const state = Save.get();
    expect(state.wallet).toBe(0);
    expect(state.ownedWeapons).toContain('pistol');
  });

  it('set should update state and storage', () => {
    Save.set({ wallet: 100 });
    expect(Save.get().wallet).toBe(100);
    expect(JSON.parse(localStorage.getItem('arenaFight.save.v1')).wallet).toBe(100);
  });

  it('set should accept a function', () => {
    Save.set((prev) => ({ ...prev, wallet: prev.wallet + 50 }));
    expect(Save.get().wallet).toBe(50);
  });

  it('addToWallet should increase wallet', () => {
    Save.addToWallet(25);
    expect(Save.get().wallet).toBe(25);
  });

  it('buyWeapon should work if affordable and not owned', () => {
    Save.addToWallet(1000);
    const state = Save.buyWeapon('burst', 110);
    expect(state.wallet).toBe(890);
    expect(state.ownedWeapons).toContain('burst');
  });

  it('buyWeapon should fail if already owned', () => {
    const state = Save.buyWeapon('pistol', 0);
    expect(state.ownedWeapons.length).toBe(1);
  });

  it('buyWeapon should fail if unaffordable', () => {
    const state = Save.buyWeapon('plasma', 3400);
    expect(state.wallet).toBe(0);
  });

  it('buyMod should work if affordable and not owned', () => {
    Save.addToWallet(1000);
    const state = Save.buyMod('quick-draw', 80);
    expect(state.wallet).toBe(920);
    expect(state.ownedMods).toContain('quick-draw');
  });

  it('buyMod should fail if already owned', () => {
    Save.addToWallet(1000);
    Save.buyMod('quick-draw', 80);
    const state = Save.buyMod('quick-draw', 80);
    expect(state.wallet).toBe(920);
  });

  it('buyMod should fail if unaffordable', () => {
    const state = Save.buyMod('quick-draw', 80);
    expect(state.wallet).toBe(0);
  });

  it('setLoadout should update loadout with array of weapons', () => {
    Save.setLoadout(['shotgun', 'pistol'], ['quick-draw', null]);
    const loadout = Save.get().loadout;
    expect(loadout.weapon).toBe('shotgun');
    expect(loadout.weapons).toEqual(['shotgun', 'pistol']);
    expect(loadout.mods[0]).toBe('quick-draw');
  });

  it('setLoadout should update loadout with single weapon', () => {
    Save.setLoadout('shotgun', ['quick-draw', null]);
    const loadout = Save.get().loadout;
    expect(loadout.weapon).toBe('shotgun');
    expect(loadout.weapons).toEqual(['shotgun', null]);
  });

  it('setBackground should update setting', () => {
    Save.setBackground('moss-ruins');
    expect(Save.get().settings.backgroundId).toBe('moss-ruins');
  });

  it('setMusicEnabled should update setting', () => {
    Save.setMusicEnabled(false);
    expect(Save.get().settings.musicEnabled).toBe(false);
  });

  it('setMusicVolume should update setting', () => {
    Save.setMusicVolume(0.1);
    expect(Save.get().settings.musicVolume).toBe(0.1);
  });

  it('setSfxEnabled should update setting', () => {
    Save.setSfxEnabled(false);
    expect(Save.get().settings.sfxEnabled).toBe(false);
  });

  it('setSfxVolume should update setting', () => {
    Save.setSfxVolume(0.1);
    expect(Save.get().settings.sfxVolume).toBe(0.1);
  });

  it('fullscreen defaults to false and setFullscreen updates it', () => {
    expect(Save.get().settings.fullscreen).toBe(false);
    Save.setFullscreen(true);
    expect(Save.get().settings.fullscreen).toBe(true);
  });

  it('recordRun should update stats', () => {
    Save.recordRun({ wave: 10, score: 5000, coinsEarned: 100 });
    const stats = Save.get().stats;
    expect(stats.bestWave).toBe(10);
    expect(stats.bestScore).toBe(5000);
    expect(stats.totalCoinsEarned).toBe(100);
    expect(Save.get().wallet).toBe(100);
  });

  it('recordRun should fold combo/kills/bosses into stats', () => {
    Save.recordRun({
      wave: 10,
      score: 5000,
      coinsEarned: 100,
      longestCombo: 6,
      kills: 40,
      bosses: 1,
    });
    Save.recordRun({
      wave: 12,
      score: 6000,
      coinsEarned: 50,
      longestCombo: 4,
      kills: 25,
      bosses: 2,
    });
    const stats = Save.get().stats;
    expect(stats.bestCombo).toBe(6);
    expect(stats.totalKills).toBe(65);
    expect(stats.bossesDefeated).toBe(3);
  });

  it('stats default to zero for the new tracked fields', () => {
    const stats = Save.get().stats;
    expect(stats.bestCombo).toBe(0);
    expect(stats.totalKills).toBe(0);
    expect(stats.bossesDefeated).toBe(0);
  });

  it('achievements default to an empty array', () => {
    expect(Save.get().achievements).toEqual([]);
  });

  it('unlockAchievements unions and dedupes ids', () => {
    Save.unlockAchievements(['wave-10', 'boss-slayer']);
    Save.unlockAchievements(['wave-10', 'first-blood']);
    expect(Save.get().achievements.sort()).toEqual(['boss-slayer', 'first-blood', 'wave-10']);
  });

  it('unlockAchievements accepts a single id', () => {
    Save.unlockAchievements('arsenal');
    expect(Save.get().achievements).toContain('arsenal');
  });

  it('recordRun should update stats without persisting coins if requested', () => {
    Save.recordRun({ wave: 5, score: 1000, coinsEarned: 50, persistCoins: false });
    expect(Save.get().wallet).toBe(0);
    expect(Save.get().stats.totalCoinsEarned).toBe(50);
  });

  it('recordRun should not decrease bestWave or bestScore', () => {
    Save.recordRun({ wave: 20, score: 10000, coinsEarned: 100 });
    Save.recordRun({ wave: 10, score: 5000, coinsEarned: 100 });
    const stats = Save.get().stats;
    expect(stats.bestWave).toBe(20);
    expect(stats.bestScore).toBe(10000);
  });

  it('reset should wipe the save', () => {
    Save.addToWallet(500);
    Save.reset();
    expect(Save.get().wallet).toBe(0);
    const raw = localStorage.getItem('arenaFight.save.v1');
    expect(JSON.parse(raw).wallet).toBe(0);
  });

  it('should handle corrupt storage data', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('arenaFight.save.v1', 'invalid-json');
    Save._clearCache();
    const state = Save.get();
    expect(state.wallet).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('should reset a save from a newer (future) version', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('arenaFight.save.v1', JSON.stringify({ version: 999, wallet: 500 }));
    Save._clearCache();
    const state = Save.get();
    expect(state.version).toBe(2);
    expect(state.wallet).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('should handle partial loadout in migration', () => {
    localStorage.setItem(
      'arenaFight.save.v1',
      JSON.stringify({
        version: 1,
        loadout: { weapons: ['pistol'] },
      }),
    );
    Save._clearCache();
    const state = Save.get();
    expect(state.loadout.weapons).toEqual(['pistol', null]);
  });

  describe('schema migration', () => {
    it('migrates a v1 single-weapon save to the current schema, preserving data', () => {
      localStorage.setItem(
        'arenaFight.save.v1',
        JSON.stringify({
          version: 1,
          wallet: 320,
          ownedWeapons: ['pistol', 'shotgun'],
          ownedMods: ['quick-draw'],
          loadout: { weapon: 'shotgun', mods: ['quick-draw', null] },
        }),
      );
      Save._clearCache();
      const state = Save.get();
      expect(state.version).toBe(2);
      expect(state.wallet).toBe(320);
      expect(state.ownedWeapons).toEqual(['pistol', 'shotgun']);
      expect(state.ownedMods).toEqual(['quick-draw']);
      expect(state.loadout.weapons).toEqual(['shotgun', null]);
      expect(state.loadout.weapon).toBe('shotgun');
    });

    it('persists the upgraded save so migrations do not re-run', () => {
      localStorage.setItem(
        'arenaFight.save.v1',
        JSON.stringify({ version: 1, wallet: 99, loadout: { weapon: 'shotgun' } }),
      );
      Save._clearCache();
      Save.get();
      const persisted = JSON.parse(localStorage.getItem('arenaFight.save.v1'));
      expect(persisted.version).toBe(2);
      expect(persisted.wallet).toBe(99);
      expect(persisted.loadout.weapons).toEqual(['shotgun', null]);
    });

    it('backs up the raw save before migrating', () => {
      const raw = JSON.stringify({ version: 1, wallet: 7 });
      localStorage.setItem('arenaFight.save.v1', raw);
      Save._clearCache();
      Save.get();
      expect(localStorage.getItem('arenaFight.save.backup')).toBe(raw);
    });

    it('treats a pre-versioning save (no version field) as v1 and migrates it', () => {
      localStorage.setItem(
        'arenaFight.save.v1',
        JSON.stringify({ wallet: 42, loadout: { weapon: 'burst' } }),
      );
      Save._clearCache();
      const state = Save.get();
      expect(state.version).toBe(2);
      expect(state.wallet).toBe(42);
      expect(state.loadout.weapons).toEqual(['burst', null]);
    });

    it('deep-merges defaults for keys missing from an older save', () => {
      localStorage.setItem(
        'arenaFight.save.v1',
        JSON.stringify({ version: 1, settings: { musicVolume: 0.2 } }),
      );
      Save._clearCache();
      const state = Save.get();
      // Provided key kept, sibling defaults backfilled.
      expect(state.settings.musicVolume).toBe(0.2);
      expect(state.settings.sfxVolume).toBe(0.75);
      expect(state.settings.fullscreen).toBe(false);
      expect(state.stats.runsPlayed).toBe(0);
    });

    it('resets to defaults when a save shape is not an object', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorage.setItem('arenaFight.save.v1', JSON.stringify([1, 2, 3]));
      Save._clearCache();
      const state = Save.get();
      expect(state.version).toBe(2);
      expect(state.wallet).toBe(0);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
