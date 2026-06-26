import Phaser from 'phaser';
import { assetPath } from './assetPath.js';
import { Save } from './save.js';

export const MUSIC_KEY = 'music-retro-game';
export const MUSIC_PATH = assetPath('assets/music/retro_game_music.mp3');
export const BOSS_MUSIC_KEY = 'music-boss';
export const BOSS_MUSIC_PATH = assetPath('assets/music/boss_battle_music.mp3');
export const SFX = {
  laser: { key: 'sfx-laser', path: assetPath('assets/sounds/laser.wav'), volume: 0.42 },
  coin: { key: 'sfx-coin', path: assetPath('assets/sounds/coin.wav'), volume: 0.5 },
  dash: { key: 'sfx-dash', path: assetPath('assets/sounds/dash.wav'), volume: 0.55 },
  gift: { key: 'sfx-gift', path: assetPath('assets/sounds/gift.wav'), volume: 0.6 },
  lose: { key: 'sfx-lose', path: assetPath('assets/sounds/lose.wav'), volume: 0.7 },
  // Combat
  enemyHit: { key: 'sfx-enemy-hit', path: assetPath('assets/sounds/enemy_hit.wav'), volume: 0.3 },
  enemyDeath: {
    key: 'sfx-enemy-death',
    path: assetPath('assets/sounds/enemy_death.wav'),
    volume: 0.4,
  },
  bossHit: { key: 'sfx-boss-hit', path: assetPath('assets/sounds/boss_hit.wav'), volume: 0.45 },
  playerHit: {
    key: 'sfx-player-hit',
    path: assetPath('assets/sounds/player_hit.wav'),
    volume: 0.5,
  },
  shieldBlock: {
    key: 'sfx-shield-block',
    path: assetPath('assets/sounds/shield_block.wav'),
    volume: 0.5,
  },
  dashReady: {
    key: 'sfx-dash-ready',
    path: assetPath('assets/sounds/dash_ready.wav'),
    volume: 0.4,
  },
  // Pickups & economy
  coinBig: { key: 'sfx-coin-big', path: assetPath('assets/sounds/coin_big.wav'), volume: 0.55 },
  comboUp: { key: 'sfx-combo-up', path: assetPath('assets/sounds/combo_up.wav'), volume: 0.4 },
  comboBreak: {
    key: 'sfx-combo-break',
    path: assetPath('assets/sounds/combo_break.wav'),
    volume: 0.4,
  },
  shieldPickup: {
    key: 'sfx-shield-pickup',
    path: assetPath('assets/sounds/shield_pickup.wav'),
    volume: 0.55,
  },
  modGrant: { key: 'sfx-mod-grant', path: assetPath('assets/sounds/mod_grant.wav'), volume: 0.6 },
  // Waves & bosses
  waveStart: {
    key: 'sfx-wave-start',
    path: assetPath('assets/sounds/wave_start.wav'),
    volume: 0.5,
  },
  waveClear: {
    key: 'sfx-wave-clear',
    path: assetPath('assets/sounds/wave_clear.wav'),
    volume: 0.55,
  },
  bossSpawn: {
    key: 'sfx-boss-spawn',
    path: assetPath('assets/sounds/boss_spawn.wav'),
    volume: 0.6,
  },
  bossPhase: {
    key: 'sfx-boss-phase',
    path: assetPath('assets/sounds/boss_phase.wav'),
    volume: 0.6,
  },
  bossDefeat: {
    key: 'sfx-boss-defeat',
    path: assetPath('assets/sounds/boss_defeat.wav'),
    volume: 0.7,
  },
  // UI & meta
  uiMove: { key: 'sfx-ui-move', path: assetPath('assets/sounds/ui_move.wav'), volume: 0.35 },
  uiConfirm: {
    key: 'sfx-ui-confirm',
    path: assetPath('assets/sounds/ui_confirm.wav'),
    volume: 0.45,
  },
  uiCancel: { key: 'sfx-ui-cancel', path: assetPath('assets/sounds/ui_cancel.wav'), volume: 0.45 },
  purchase: { key: 'sfx-purchase', path: assetPath('assets/sounds/purchase.wav'), volume: 0.55 },
  purchaseFail: {
    key: 'sfx-purchase-fail',
    path: assetPath('assets/sounds/purchase_fail.wav'),
    volume: 0.5,
  },
  gameStart: {
    key: 'sfx-game-start',
    path: assetPath('assets/sounds/game_start.wav'),
    volume: 0.6,
  },
};
const MUSIC_MANAGER_KEY = 'backgroundMusicManager';
const CROSSFADE_MS = 2600;
const FADE_STEP_MS = 80;
// Quick, punchy cross-fade when entering/leaving a boss fight.
const BOSS_FADE_MS = 900;

export function preloadMusic(scene) {
  if (!scene.cache.audio.exists(MUSIC_KEY)) {
    scene.load.audio(MUSIC_KEY, MUSIC_PATH);
  }
  if (!scene.cache.audio.exists(BOSS_MUSIC_KEY)) {
    scene.load.audio(BOSS_MUSIC_KEY, BOSS_MUSIC_PATH);
  }
}

export function preloadSfx(scene) {
  for (const sfx of Object.values(SFX)) {
    if (!scene.cache.audio.exists(sfx.key)) {
      scene.load.audio(sfx.key, sfx.path);
    }
  }
}

export function playSfx(scene, id, volumeMult = 1) {
  const sfx = SFX[id];
  if (!sfx || scene.sound.locked || !scene.cache.audio.exists(sfx.key)) return;
  const settings = Save.get().settings || {};
  if (settings.sfxEnabled === false) return;
  const sfxVolume = Phaser.Math.Clamp(settings.sfxVolume ?? 0.75, 0, 1);
  scene.sound.play(sfx.key, {
    volume: Phaser.Math.Clamp(sfx.volume * volumeMult * sfxVolume, 0, 1),
  });
}

export function syncMusic(scene) {
  const settings = Save.get().settings || {};
  const enabled = settings.musicEnabled !== false;
  const volume = Phaser.Math.Clamp(settings.musicVolume ?? 0.55, 0, 1);
  const manager = getMusicManager(scene);

  manager.volume = volume;
  adoptScene(scene, manager);
  // During a boss fight the boss track owns the volume and the normal tracks stay
  // silent; otherwise the active normal track carries it.
  if (manager.bossMode) {
    manager.tracks.forEach((track) => {
      track.setVolume(0);
    });
    if (manager.bossTrack.isPlaying) manager.bossTrack.setVolume(volume);
  } else {
    // Not a boss fight: hard-stop any lingering boss track. A boss-exit fade tween
    // can be killed by a scene shutdown (player dies mid-boss) before it stops the
    // track, so guarantee silence here — every scene calls syncMusic on entry.
    scene.tweens.killTweensOf(manager.bossTrack);
    manager.bossFadeTween = null;
    if (manager.bossTrack.isPlaying) manager.bossTrack.stop();
    manager.bossTrack.setVolume(0);
    manager.tracks.forEach((track, index) => {
      if (index === manager.activeIndex && track.isPlaying) track.setVolume(volume);
      else track.setVolume(0);
    });
  }

  if (!enabled) {
    stopMusic(scene, manager);
    return manager;
  }

  if (scene.sound.locked) {
    if (!manager.unlockArmed) {
      manager.unlockArmed = true;
      scene.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
        manager.unlockArmed = false;
        if (Save.get().settings?.musicEnabled !== false) resumeMusic(scene, manager);
      });
    }
    return manager;
  }

  resumeMusic(scene, manager);
  return manager;
}

// Resume whichever soundtrack should be audible right now: the boss track during
// a boss fight, the normal looping track otherwise.
function resumeMusic(scene, manager) {
  if (manager.bossMode) startBossTrack(manager);
  else startMusic(scene, manager);
}

function getMusicManager(scene) {
  let manager = scene.registry.get(MUSIC_MANAGER_KEY);
  if (!manager) {
    manager = {
      tracks: [
        scene.sound.add(MUSIC_KEY, { loop: false, volume: 0 }),
        scene.sound.add(MUSIC_KEY, { loop: false, volume: 0 }),
      ],
      // A single looping instance owns the boss soundtrack; it ducks the normal
      // tracks out while a boss fight is live (see enterBossMusic/exitBossMusic).
      bossTrack: scene.sound.add(BOSS_MUSIC_KEY, { loop: true, volume: 0 }),
      bossMode: false,
      bossFadeTween: null,
      activeIndex: 0,
      volume: 0,
      timer: null,
      fadeTimer: null,
      endTimer: null,
      sceneKey: null,
      unlockArmed: false,
      fading: false,
    };
    scene.registry.set(MUSIC_MANAGER_KEY, manager);
  }
  return manager;
}

function adoptScene(scene, manager) {
  const sceneKey = scene.scene.key;
  if (manager.sceneKey === sceneKey) return;

  if (manager.timer) {
    manager.timer.remove(false);
    manager.timer = null;
  }
  if (manager.fadeTimer) {
    manager.fadeTimer.remove(false);
    manager.fadeTimer = null;
  }
  if (manager.endTimer) {
    manager.endTimer.remove(false);
    manager.endTimer = null;
  }

  manager.fading = false;
  manager.sceneKey = sceneKey;

  let activeIndex = manager.activeIndex;
  let bestVolume = -1;
  manager.tracks.forEach((track, index) => {
    if (track.isPlaying && track.volume > bestVolume) {
      activeIndex = index;
      bestVolume = track.volume;
    }
  });
  manager.activeIndex = activeIndex;
  manager.tracks.forEach((track, index) => {
    if (index !== manager.activeIndex && track.isPlaying) track.stop();
  });
}

function startMusic(scene, manager) {
  const active = manager.tracks[manager.activeIndex];
  if (!active.isPlaying) {
    active.play({ volume: manager.volume });
  }
  active.setVolume(manager.volume);
  scheduleCrossfade(scene, manager);
}

// Ensure the boss track is the one playing (used when re-syncing during a fight,
// e.g. after the music toggle is turned back on mid-boss).
function startBossTrack(manager) {
  stopNormalScheduler(manager);
  manager.tracks.forEach((track) => {
    if (track.isPlaying) track.setVolume(0);
  });
  const boss = manager.bossTrack;
  if (!boss.isPlaying) boss.play({ volume: manager.volume });
  boss.setVolume(manager.volume);
}

// Clear the normal track's loop scheduler so it can't re-raise a ducked track.
function stopNormalScheduler(manager) {
  if (manager.timer) {
    manager.timer.remove(false);
    manager.timer = null;
  }
  if (manager.fadeTimer) {
    manager.fadeTimer.remove(false);
    manager.fadeTimer = null;
  }
  if (manager.endTimer) {
    manager.endTimer.remove(false);
    manager.endTimer = null;
  }
  manager.fading = false;
}

function stopMusic(scene, manager) {
  stopNormalScheduler(manager);
  scene.tweens.killTweensOf(manager.tracks);
  scene.tweens.killTweensOf(manager.bossTrack);
  manager.bossFadeTween = null;
  manager.tracks.forEach((track) => {
    if (track.isPlaying) track.stop();
    track.setVolume(0);
  });
  if (manager.bossTrack.isPlaying) manager.bossTrack.stop();
  manager.bossTrack.setVolume(0);
}

function scheduleCrossfade(scene, manager) {
  if (manager.timer) {
    manager.timer.remove(false);
    manager.timer = null;
  }
  if (manager.endTimer) {
    manager.endTimer.remove(false);
    manager.endTimer = null;
  }

  // The boss track owns the soundtrack while a boss is alive; don't loop the
  // (ducked, silent) normal track underneath it.
  if (manager.bossMode) return;

  const active = manager.tracks[manager.activeIndex];
  if (!active.isPlaying) return;

  const durationMs = (active.duration || 0) * 1000;
  if (!durationMs) {
    manager.timer = scene.time.delayedCall(250, () => scheduleCrossfade(scene, manager));
    return;
  }

  const seekMs = Phaser.Math.Clamp((active.seek || 0) * 1000, 0, durationMs);
  const remainingMs = Math.max(0, durationMs - seekMs);
  const fadeMs = Math.min(CROSSFADE_MS, Math.max(350, remainingMs - 120));
  const delay = Math.max(0, remainingMs - fadeMs);

  manager.timer = scene.time.delayedCall(delay, () => crossfadeToNext(scene, manager, fadeMs));
  manager.endTimer = scene.time.delayedCall(remainingMs + 120, () => {
    if (manager.fading || Save.get().settings?.musicEnabled === false) return;
    crossfadeToNext(scene, manager, 350);
  });
}

function crossfadeToNext(scene, manager, fadeMs = CROSSFADE_MS) {
  if (manager.fading || manager.bossMode || Save.get().settings?.musicEnabled === false) return;
  manager.fading = true;
  if (manager.timer) {
    manager.timer.remove(false);
    manager.timer = null;
  }
  if (manager.endTimer) {
    manager.endTimer.remove(false);
    manager.endTimer = null;
  }

  const current = manager.tracks[manager.activeIndex];
  const nextIndex = (manager.activeIndex + 1) % manager.tracks.length;
  const next = manager.tracks[nextIndex];
  const targetVolume = manager.volume;
  let elapsed = 0;

  if (next.isPlaying) next.stop();
  next.play({ volume: 0 });

  manager.fadeTimer = scene.time.addEvent({
    delay: FADE_STEP_MS,
    repeat: Math.ceil(fadeMs / FADE_STEP_MS),
    callback: () => {
      elapsed += FADE_STEP_MS;
      const t = Phaser.Math.Clamp(elapsed / fadeMs, 0, 1);
      const volume = Save.get().settings?.musicVolume ?? targetVolume;
      manager.volume = Phaser.Math.Clamp(volume, 0, 1);
      current.setVolume(current.isPlaying ? manager.volume * (1 - t) : 0);
      next.setVolume(manager.volume * t);

      if (t >= 1) {
        manager.fadeTimer.remove(false);
        manager.fadeTimer = null;
        if (current.isPlaying) current.stop();
        current.setVolume(0);
        next.setVolume(manager.volume);
        manager.activeIndex = nextIndex;
        manager.fading = false;
        scheduleCrossfade(scene, manager);
      }
    },
  });
}

// Swap to the intense boss soundtrack: duck the normal track out and cross-fade
// the boss track in. Safe to call once per boss fight; respects the music setting.
export function enterBossMusic(scene) {
  const manager = getMusicManager(scene);
  if (manager.bossMode) return;
  manager.bossMode = true;

  // Stop the normal loop scheduler so it can't re-raise the ducked tracks.
  stopNormalScheduler(manager);
  scene.tweens.killTweensOf(manager.tracks);
  scene.tweens.killTweensOf(manager.bossTrack);
  manager.bossFadeTween = null;

  // If music is off (or audio not yet unlocked), just flag the mode so a later
  // toggle-on / unlock resumes the boss track instead of the normal one.
  if (Save.get().settings?.musicEnabled === false || scene.sound.locked) return;

  const target = manager.volume;
  manager.tracks.forEach((track) => {
    if (track.isPlaying) {
      scene.tweens.add({ targets: track, volume: 0, duration: BOSS_FADE_MS });
    }
  });

  const boss = manager.bossTrack;
  if (!boss.isPlaying) boss.play({ volume: 0 });
  boss.setVolume(0);
  manager.bossFadeTween = scene.tweens.add({
    targets: boss,
    volume: target,
    duration: BOSS_FADE_MS,
    onComplete: () => {
      manager.bossFadeTween = null;
    },
  });
}

// Resolve back to the normal soundtrack after a boss fight. Idempotent: a no-op
// when no boss music is active, so it's safe on every exit path (boss death,
// jumpToWave, player death, scene shutdown).
export function exitBossMusic(scene) {
  const manager = getMusicManager(scene);
  if (!manager.bossMode) return;
  manager.bossMode = false;

  scene.tweens.killTweensOf(manager.bossTrack);
  manager.bossFadeTween = null;

  // Music off (or not yet unlocked): silence the boss track and leave the normal
  // tracks alone — syncMusic will start them when music is next enabled.
  if (Save.get().settings?.musicEnabled === false || scene.sound.locked) {
    if (manager.bossTrack.isPlaying) manager.bossTrack.stop();
    manager.bossTrack.setVolume(0);
    return;
  }

  const target = manager.volume;
  manager.bossFadeTween = scene.tweens.add({
    targets: manager.bossTrack,
    volume: 0,
    duration: BOSS_FADE_MS,
    onComplete: () => {
      manager.bossFadeTween = null;
      if (manager.bossTrack.isPlaying) manager.bossTrack.stop();
    },
  });

  // Bring the normal track back and re-arm its gapless-loop scheduler.
  const active = manager.tracks[manager.activeIndex];
  scene.tweens.killTweensOf(active);
  if (!active.isPlaying) active.play({ volume: 0 });
  scene.tweens.add({ targets: active, volume: target, duration: BOSS_FADE_MS });
  scheduleCrossfade(scene, manager);
}
