import Phaser from 'phaser';
import { CFG } from './config.js';
import GameScene from './scenes/GameScene.js';
import IntroScene from './scenes/IntroScene.js';
import LoadoutScene from './scenes/LoadoutScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import MonstersScene from './scenes/MonstersScene.js';
import SettingsScene from './scenes/SettingsScene.js';
import StoreScene from './scenes/StoreScene.js';

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

new Phaser.Game(config);
