import Phaser from 'phaser';
import { installOrientationLock } from './input/orientationLock.js';
import { touchActive } from './input/touchMode.js';
import GameScene from './scenes/GameScene.js';
import IntroScene from './scenes/IntroScene.js';
import LoadoutScene from './scenes/LoadoutScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import MonstersScene from './scenes/MonstersScene.js';
import SettingsScene from './scenes/SettingsScene.js';
import StoreScene from './scenes/StoreScene.js';
import { installViewport, resolveInitialScaleConfig } from './viewport.js';

// Resolved once at boot. When false (desktop/web), the scale stays NONE 800x600
// and no orientation lock is installed, so the existing experience is unchanged.
const touch = touchActive();

// Gate the fill CSS (index.html) to mobile so the desktop windowed canvas keeps
// its flex-centered 800x600 box.
if (touch && typeof document !== 'undefined') {
  document.body.classList.add('touch');
}

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1a1a1a',
  scale: { parent: 'game', ...resolveInitialScaleConfig(touch) },
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

installViewport(game, { touch });

if (touch) {
  installOrientationLock(game);
}
