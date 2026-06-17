import Phaser from 'phaser';
import { CFG } from './config.js';
import { installOrientationLock } from './input/orientationLock.js';
import { touchActive } from './input/touchMode.js';
import GameScene from './scenes/GameScene.js';
import IntroScene from './scenes/IntroScene.js';
import LoadoutScene from './scenes/LoadoutScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import MonstersScene from './scenes/MonstersScene.js';
import SettingsScene from './scenes/SettingsScene.js';
import StoreScene from './scenes/StoreScene.js';

// Resolved once at boot. When false (desktop/web), the scale stays NONE and no
// orientation lock is installed, so the existing experience is unchanged.
const touch = touchActive();

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: CFG.arena.width,
  height: CFG.arena.height,
  backgroundColor: '#1a1a1a',
  scale: touch
    ? { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
    : { mode: Phaser.Scale.NONE },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scene: [
    IntroScene,
    MainMenuScene,
    GameScene,
    StoreScene,
    LoadoutScene,
    SettingsScene,
    MonstersScene,
  ],
};

const game = new Phaser.Game(config);

if (touch) {
  installOrientationLock(game);
}
