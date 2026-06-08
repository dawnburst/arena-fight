import Phaser from 'phaser';
import { CFG } from '../config.js';
import { Save } from '../save.js';
import {
  ARENA_BACKGROUNDS,
  backgroundKey,
  backgroundPath,
  resolveBackground,
} from '../backgrounds.js';

export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  preload() {
    for (const background of ARENA_BACKGROUNDS) {
      const key = backgroundKey(background.id);
      if (!this.textures.exists(key)) {
        this.load.image(key, backgroundPath(background));
      }
    }
  }

  create() {
    const style = {
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      color: '#ffffff',
    };
    const current = resolveBackground(Save.get().settings?.backgroundId);
    this.selectedIndex = Math.max(0, ARENA_BACKGROUNDS.findIndex((bg) => bg.id === current.id));

    this.add.image(0, 0, backgroundKey(current.id)).setOrigin(0).setDepth(-20);
    this.add.rectangle(0, 0, CFG.arena.width, CFG.arena.height, 0x000000, 0.48).setOrigin(0);

    this.add.text(26, 18, 'SETTINGS', { ...style, fontSize: '30px', color: '#ffffff' });
    this.add.text(28, 58, 'choose arena background', {
      ...style,
      fontSize: '14px',
      color: '#bbbbbb',
    });

    this.views = [];
    const cardWidth = 230;
    const cardHeight = 255;
    const startX = 36;
    const y = 118;
    const gap = 18;

    ARENA_BACKGROUNDS.forEach((background, index) => {
      const x = startX + index * (cardWidth + gap);
      const container = this.add.container(x, y);
      const frame = this.add.graphics();
      const image = this.add
        .image(cardWidth / 2, 72, backgroundKey(background.id))
        .setDisplaySize(196, 147);
      const title = this.add.text(18, 166, background.name, {
        ...style,
        fontSize: '19px',
      });
      const desc = this.add.text(18, 198, background.description, {
        ...style,
        fontSize: '12px',
        color: '#cfcfcf',
        wordWrap: { width: cardWidth - 36 },
      });
      const marker = this.add.text(cardWidth - 18, 18, '', {
        ...style,
        fontSize: '18px',
        color: '#69f0ae',
      }).setOrigin(1, 0);

      container.add([frame, image, title, desc, marker]);
      container
        .setSize(cardWidth, cardHeight)
        .setInteractive(new Phaser.Geom.Rectangle(0, 0, cardWidth, cardHeight), Phaser.Geom.Rectangle.Contains)
        .on('pointerover', () => {
          this.input.setDefaultCursor('pointer');
          this.select(index);
        })
        .on('pointerout', () => this.input.setDefaultCursor('default'))
        .on('pointerdown', () => this.applySelection(index));

      this.views.push({ container, frame, title, desc, marker });
    });

    this.hintText = this.add.text(
      CFG.arena.width / 2,
      CFG.arena.height - 38,
      '←/→ select  •  enter apply  •  B / Esc back',
      { ...style, fontSize: '13px', color: '#cccccc' },
    ).setOrigin(0.5);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.input.keyboard.on('keydown', this.onKey, this);
    this.refresh();
  }

  shutdown() {
    this.input.setDefaultCursor('default');
    this.input.keyboard.off('keydown', this.onKey, this);
  }

  onKey(event) {
    if (event.key === 'b' || event.key === 'B' || event.key === 'Escape') {
      this.scene.start('MainMenuScene');
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault?.();
      this.select(this.selectedIndex - 1);
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault?.();
      this.select(this.selectedIndex + 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ' || event.code === 'Space') {
      event.preventDefault?.();
      this.applySelection(this.selectedIndex);
    }
  }

  select(index) {
    this.selectedIndex = Phaser.Math.Wrap(index, 0, ARENA_BACKGROUNDS.length);
    this.refresh();
  }

  applySelection(index) {
    this.selectedIndex = Phaser.Math.Wrap(index, 0, ARENA_BACKGROUNDS.length);
    Save.setBackground(ARENA_BACKGROUNDS[this.selectedIndex].id);
    this.refresh();
  }

  refresh() {
    const current = resolveBackground(Save.get().settings?.backgroundId);
    this.views.forEach((view, index) => {
      const background = ARENA_BACKGROUNDS[index];
      const selected = index === this.selectedIndex;
      const active = background.id === current.id;
      const borderColor = active ? 0x69f0ae : selected ? 0xffd54f : 0x444444;

      view.frame.clear();
      view.frame.fillStyle(0x121812, selected ? 0.98 : 0.88);
      view.frame.fillRoundedRect(0, 0, 230, 255, 8);
      view.frame.lineStyle(selected ? 4 : 2, borderColor, 1);
      view.frame.strokeRoundedRect(0, 0, 230, 255, 8);
      view.title.setColor(active ? '#69f0ae' : selected ? '#ffd54f' : '#ffffff');
      view.desc.setColor(selected ? '#ffffff' : '#bfbfbf');
      view.marker.setText(active ? 'ON' : '');
      view.container.setScale(selected ? 1.02 : 1);
    });
  }
}
