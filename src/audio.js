import Phaser from 'phaser';
import { Save } from './save.js';

export const MUSIC_KEY = 'music-retro-game';
export const MUSIC_PATH = '/assets/music/retro_game_music.mp3';
export const SFX = {
  laser: { key: 'sfx-laser', path: '/assets/sounds/laser.wav', volume: 0.42 },
  coin: { key: 'sfx-coin', path: '/assets/sounds/coin.wav', volume: 0.5 },
  dash: { key: 'sfx-dash', path: '/assets/sounds/dash.wav', volume: 0.55 },
  gift: { key: 'sfx-gift', path: '/assets/sounds/gift.wav', volume: 0.6 },
  lose: { key: 'sfx-lose', path: '/assets/sounds/lose.wav', volume: 0.7 },
};
const MUSIC_MANAGER_KEY = 'backgroundMusicManager';
const CROSSFADE_MS = 2600;
const FADE_STEP_MS = 80;

export function preloadMusic(scene) {
  if (!scene.cache.audio.exists(MUSIC_KEY)) {
    scene.load.audio(MUSIC_KEY, MUSIC_PATH);
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
  manager.tracks.forEach((track, index) => {
    if (index === manager.activeIndex && track.isPlaying) track.setVolume(volume);
    else track.setVolume(0);
  });

  if (!enabled) {
    stopMusic(scene, manager);
    return manager;
  }

  if (scene.sound.locked) {
    if (!manager.unlockArmed) {
      manager.unlockArmed = true;
      scene.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
        manager.unlockArmed = false;
        if (Save.get().settings?.musicEnabled !== false) startMusic(scene, manager);
      });
    }
    return manager;
  }

  startMusic(scene, manager);
  return manager;
}

function getMusicManager(scene) {
  let manager = scene.registry.get(MUSIC_MANAGER_KEY);
  if (!manager) {
    manager = {
      tracks: [
        scene.sound.add(MUSIC_KEY, { loop: false, volume: 0 }),
        scene.sound.add(MUSIC_KEY, { loop: false, volume: 0 }),
      ],
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

function stopMusic(scene, manager) {
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
  manager.tracks.forEach((track) => {
    if (track.isPlaying) track.stop();
    track.setVolume(0);
  });
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
  if (manager.fading || Save.get().settings?.musicEnabled === false) return;
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
