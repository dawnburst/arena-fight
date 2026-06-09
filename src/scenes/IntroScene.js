import Phaser from 'phaser';
import { CFG } from '../config.js';
import { preloadMusic, syncMusic } from '../audio.js';

export default class IntroScene extends Phaser.Scene {
  constructor() {
    super('IntroScene');
  }

  preload() {
    if (!this.textures.exists('intro-art')) {
      this.load.image('intro-art', '/assets/intro/intro.png');
    }
    preloadMusic(this);
  }

  create() {
    this.started = false;
    syncMusic(this);
    const style = {
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      color: '#ffffff',
    };

    this.addCoverImage('intro-art');
    this.add.rectangle(0, 0, CFG.arena.width, CFG.arena.height, 0x000000, 0.22).setOrigin(0);
    this.add.rectangle(0, 0, CFG.arena.width, CFG.arena.height, 0x000000, 0.34).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY);

    const titleShadow = this.add.text(CFG.arena.width / 2 + 5, 94 + 5, 'ARENA FIGHT', {
      ...style,
      fontSize: '66px',
      color: '#000000',
    }).setOrigin(0.5).setAlpha(0);

    const title = this.add.text(CFG.arena.width / 2, 94, 'ARENA FIGHT', {
      ...style,
      fontSize: '66px',
      color: '#ffd54f',
    }).setOrigin(0.5).setAlpha(0);

    const prompt = this.add.text(CFG.arena.width / 2, CFG.arena.height - 44, 'click or press enter', {
      ...style,
      fontSize: '13px',
      color: '#d8d8d8',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: [titleShadow, title],
      alpha: 1,
      y: '-=16',
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 850,
      ease: 'Back.out',
      delay: 250,
    });
    this.tweens.add({
      targets: title,
      y: '+=8',
      duration: 1700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: titleShadow,
      y: '+=8',
      duration: 1700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: prompt,
      alpha: { from: 0.18, to: 1 },
      duration: 850,
      yoyo: true,
      repeat: -1,
      delay: 1400,
    });

    this.input.once('pointerdown', () => this.startMenu());
    this.input.keyboard.once('keydown-ENTER', () => this.startMenu());
    this.input.keyboard.once('keydown-SPACE', () => this.startMenu());
    this.input.keyboard.once('keydown-ESC', () => this.startMenu());
    this.time.delayedCall(9200, () => this.startMenu());
  }

  addCoverImage(key) {
    const source = this.textures.get(key).getSourceImage();
    const scale = Math.max(CFG.arena.width / source.width, CFG.arena.height / source.height);
    this.add.image(CFG.arena.width / 2, CFG.arena.height / 2, key)
      .setOrigin(0.5)
      .setScale(scale);
  }

  startMenu() {
    if (this.started) return;
    this.started = true;
    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.time.delayedCall(260, () => this.scene.start('MainMenuScene'));
  }
}
