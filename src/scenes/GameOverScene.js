import Phaser from 'phaser';
import { CFG } from '../config.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.finalScore = data?.score ?? 0;
    this.finalWave = data?.wave ?? 1;
  }

  create() {
    const cx = CFG.arena.width / 2;
    const cy = CFG.arena.height / 2;
    const baseStyle = {
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      color: '#ffffff',
    };

    this.add
      .text(cx, cy - 80, 'GAME OVER', { ...baseStyle, fontSize: '48px', color: '#e53935' })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 10, `Wave reached: ${this.finalWave}`, { ...baseStyle, fontSize: '22px' })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 24, `Score: ${this.finalScore}`, { ...baseStyle, fontSize: '22px' })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 90, 'press R to restart', {
        ...baseStyle,
        fontSize: '16px',
        color: '#bbbbbb',
      })
      .setOrigin(0.5);

    this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.input.once('pointerdown', () => this.scene.start('GameScene'));
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.rKey)) {
      this.scene.start('GameScene');
    }
  }
}
