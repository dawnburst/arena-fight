import Phaser from 'phaser';
import { CFG } from '../config.js';
import { ENEMY_BESTIARY, ENEMY_SPRITES } from '../enemies.js';

const STYLE = {
  fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  color: '#ffffff',
};

// Bestiary ids map to CFG blocks by name, except the swarmer (CFG.enemy).
const enemyMaxHp = (id) => (id === 'swarmer' ? CFG.enemy.hp : (CFG[id]?.hp ?? 1));

export default class MonstersScene extends Phaser.Scene {
  constructor() {
    super('MonstersScene');
  }

  preload() {
    for (const sprite of Object.values(ENEMY_SPRITES)) {
      if (!this.textures.exists(sprite.key)) {
        this.load.spritesheet(sprite.key, sprite.path, {
          frameWidth: sprite.frameWidth,
          frameHeight: sprite.frameHeight,
        });
      }
    }
  }

  create() {
    this.selectedIndex = 0;
    this.mode = 'gallery';

    this.add.rectangle(0, 0, CFG.arena.width, CFG.arena.height, 0x111511, 1).setOrigin(0);
    this.add.rectangle(0, 0, CFG.arena.width, CFG.arena.height, 0x234022, 0.18).setOrigin(0);

    this.title = this.add.text(28, 20, 'MONSTERS', { ...STYLE, fontSize: '30px' });
    this.subtitle = this.add.text(30, 58, 'select a monster to inspect its power', {
      ...STYLE,
      fontSize: '13px',
      color: '#b9d7b3',
    });

    this.gallery = this.add.container(0, 0);
    this.detail = this.add.container(0, 0).setVisible(false);

    this.createGallery();
    this.createDetail();

    this.hint = this.add.text(
      CFG.arena.width / 2,
      CFG.arena.height - 28,
      'arrows select  •  enter inspect  •  B / Esc back',
      { ...STYLE, fontSize: '12px', color: '#b7c7b3' },
    ).setOrigin(0.5);

    this.input.keyboard.on('keydown', this.onKey, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.refreshGallery();
  }

  shutdown() {
    this.input.setDefaultCursor('default');
    this.input.keyboard.off('keydown', this.onKey, this);
  }

  createGallery() {
    const startX = 26;
    const startY = 96;
    const cardW = 140;
    const cardH = 132;
    const gap = 12;
    const rowGap = 16;
    const columns = 5;

    this.cards = ENEMY_BESTIARY.map((enemy, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + rowGap);
      const container = this.add.container(x, y);
      const bg = this.add.graphics();
      const spriteDef = ENEMY_SPRITES[enemy.sprite];
      const portrait = this.add.sprite(cardW / 2, 46, spriteDef.key, enemy.frame)
        .setScale(0.7);
      if (enemy.tint) portrait.setTint(enemy.tint);
      const name = this.add.text(cardW / 2, 86, enemy.name, {
        ...STYLE,
        fontSize: '13px',
      }).setOrigin(0.5);
      const wave = this.add.text(cardW / 2, 104, enemy.firstWave, {
        ...STYLE,
        fontSize: '11px',
        color: '#ffd54f',
      }).setOrigin(0.5);
      const hp = this.add.text(cardW / 2, 120, `HP ${enemyMaxHp(enemy.id)}`, {
        ...STYLE,
        fontSize: '11px',
        color: '#ff8a80',
      }).setOrigin(0.5);

      container.add([bg, portrait, name, wave, hp]);
      container
        .setSize(cardW, cardH)
        .setInteractive(new Phaser.Geom.Rectangle(0, 0, cardW, cardH), Phaser.Geom.Rectangle.Contains)
        .on('pointerover', () => {
          this.input.setDefaultCursor('pointer');
          this.select(index);
        })
        .on('pointerout', () => this.input.setDefaultCursor('default'))
        .on('pointerdown', () => this.openDetail(index));

      this.gallery.add(container);
      return { container, bg, portrait, name, wave };
    });
  }

  createDetail() {
    this.detailBg = this.add.graphics();
    this.detailPortrait = this.add.sprite(190, 230, ENEMY_SPRITES.monster.key, 0).setScale(3.1);
    this.detailName = this.add.text(360, 116, '', { ...STYLE, fontSize: '34px', color: '#ffd54f' });
    this.detailWave = this.add.text(362, 160, '', { ...STYLE, fontSize: '15px', color: '#b9d7b3' });
    this.detailHp = this.add.text(362, 184, '', { ...STYLE, fontSize: '15px', color: '#ff8a80' });
    this.detailMovement = this.add.text(362, 218, '', {
      ...STYLE,
      fontSize: '15px',
      color: '#ffffff',
      wordWrap: { width: 370 },
    });
    this.detailPower = this.add.text(362, 318, '', {
      ...STYLE,
      fontSize: '15px',
      color: '#ffcc80',
      wordWrap: { width: 370 },
    });
    this.detailCounter = this.add.text(362, 430, '', {
      ...STYLE,
      fontSize: '15px',
      color: '#a5d6a7',
      wordWrap: { width: 370 },
    });

    this.detail.add([
      this.detailBg,
      this.detailPortrait,
      this.detailName,
      this.detailWave,
      this.detailHp,
      this.detailMovement,
      this.detailPower,
      this.detailCounter,
    ]);
  }

  onKey(event) {
    const k = event.key?.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'enter', ' ', 'b', 'escape'].includes(k) || event.code === 'Space') {
      event.preventDefault?.();
    }

    if (this.mode === 'detail') {
      if (k === 'b' || event.key === 'Escape') this.showGallery();
      return;
    }

    if (k === 'b' || event.key === 'Escape') this.scene.start('MainMenuScene');
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') this.select(this.selectedIndex - 1);
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') this.select(this.selectedIndex + 1);
    else if (event.key === 'Enter' || event.key === ' ' || event.code === 'Space') this.openDetail(this.selectedIndex);
  }

  select(index) {
    this.selectedIndex = Phaser.Math.Wrap(index, 0, ENEMY_BESTIARY.length);
    this.refreshGallery();
  }

  refreshGallery() {
    this.cards.forEach((card, index) => {
      const selected = index === this.selectedIndex;
      card.bg.clear();
      card.bg.fillStyle(0x151b15, selected ? 0.98 : 0.82);
      card.bg.fillRoundedRect(0, 0, 140, 132, 8);
      card.bg.lineStyle(selected ? 4 : 2, selected ? 0xffd54f : 0x446044, 1);
      card.bg.strokeRoundedRect(0, 0, 140, 132, 8);
      card.container.setScale(selected ? 1.03 : 1);
      card.name.setColor(selected ? '#ffffff' : '#dddddd');
    });
  }

  openDetail(index) {
    this.selectedIndex = Phaser.Math.Wrap(index, 0, ENEMY_BESTIARY.length);
    const enemy = ENEMY_BESTIARY[this.selectedIndex];
    const spriteDef = ENEMY_SPRITES[enemy.sprite];

    this.mode = 'detail';
    this.gallery.setVisible(false);
    this.detail.setVisible(true);
    this.subtitle.setText('monster details');
    this.hint.setText('B / Esc back to monster gallery');

    this.detailBg.clear();
    this.detailBg.fillStyle(0x151b15, 0.96);
    this.detailBg.fillRoundedRect(42, 94, 716, 410, 8);
    this.detailBg.lineStyle(3, 0x446044, 1);
    this.detailBg.strokeRoundedRect(42, 94, 716, 410, 8);
    this.detailBg.fillStyle(0x0b0f0b, 0.85);
    this.detailBg.fillRoundedRect(82, 132, 220, 220, 8);

    this.detailPortrait.setTexture(spriteDef.key, enemy.frame);
    this.detailPortrait.clearTint();
    if (enemy.tint) this.detailPortrait.setTint(enemy.tint);
    this.detailName.setText(enemy.name);
    this.detailWave.setText(`Appears: ${enemy.firstWave}`);
    this.detailHp.setText(`Health: ${enemyMaxHp(enemy.id)} HP`);
    this.detailMovement.setText(`Movement\n${enemy.movement}`);
    this.detailPower.setText(`Special Power\n${enemy.power}`);
    this.detailCounter.setText(`How to Fight\n${enemy.counter}`);
  }

  showGallery() {
    this.mode = 'gallery';
    this.gallery.setVisible(true);
    this.detail.setVisible(false);
    this.subtitle.setText('select a monster to inspect its power');
    this.hint.setText('arrows select  •  enter inspect  •  B / Esc back');
    this.refreshGallery();
  }
}
