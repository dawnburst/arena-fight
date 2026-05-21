import Phaser from 'phaser';
import { CFG } from './config.js';
import GameScene from './scenes/GameScene.js';
import GameOverScene from './scenes/GameOverScene.js';

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
  scene: [GameScene, GameOverScene],
};

new Phaser.Game(config);
