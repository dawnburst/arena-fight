import Phaser from 'phaser';
import { CFG } from './config.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import GameScene from './scenes/GameScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import StoreScene from './scenes/StoreScene.js';
import LoadoutScene from './scenes/LoadoutScene.js';
import SettingsScene from './scenes/SettingsScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: CFG.arena.width,
  height: CFG.arena.height,
  backgroundColor: '#1a1a1a',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scene: [MainMenuScene, GameScene, GameOverScene, StoreScene, LoadoutScene, SettingsScene],
};

new Phaser.Game(config);
