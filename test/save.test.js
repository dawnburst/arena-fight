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

  it('recordRun should update stats', () => {
    Save.recordRun({ wave: 10, score: 5000, coinsEarned: 100 });
    const stats = Save.get().stats;
    expect(stats.bestWave).toBe(10);
    expect(stats.bestScore).toBe(5000);
    expect(stats.totalCoinsEarned).toBe(100);
    expect(Save.get().wallet).toBe(100);
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

  it('should handle unknown version in storage', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('arenaFight.save.v1', JSON.stringify({ version: 999 }));
    Save._clearCache();
    const state = Save.get();
    expect(state.version).toBe(1);
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
});
