import Phaser from 'phaser';
import { preloadMusic, syncMusic } from '../audio.js';
import {
  ARENA_BACKGROUNDS,
  backgroundKey,
  backgroundPath,
  resolveBackground,
} from '../backgrounds.js';
import { CFG } from '../config.js';
import { Save } from '../save.js';

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  init(data) {
    this.gameOverData = data?.gameOver ? data : null;
  }

  preload() {
    for (const background of ARENA_BACKGROUNDS) {
      const key = backgroundKey(background.id);
      if (!this.textures.exists(key)) {
        this.load.image(key, backgroundPath(background));
      }
    }
    preloadMusic(this);
  }

  create() {
    syncMusic(this);
    const style = {
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      color: '#ffffff',
    };
    const selectedBackground = resolveBackground(Save.get().settings?.backgroundId);

    this.add.image(0, 0, backgroundKey(selectedBackground.id)).setOrigin(0).setDepth(-20);
    this.add.rectangle(0, 0, CFG.arena.width, CFG.arena.height, 0x000000, 0.34).setOrigin(0);

    this.add.text(58, 72, 'ARENA FIGHT', {
      ...style,
      fontSize: '54px',
      color: '#ffd54f',
    });
    if (this.gameOverData) {
      this.add.text(62, 132, 'run ended', {
        ...style,
        fontSize: '16px',
        color: '#ff8a80',
      });
    }

    if (this.gameOverData) {
      this.createGameOverDetails(style);
    }

    this.add.text(62, CFG.arena.height - 46, `Arena: ${selectedBackground.name}`, {
      ...style,
      fontSize: '14px',
      color: '#d7f5c3',
    });

    this.actionIndex = 0;
    const submenuData = () => ({
      returnScene: 'MainMenuScene',
      ...(this.gameOverData || {}),
    });
    const firstAction = this.gameOverData
      ? {
          label: 'RETRY',
          shortcut: 'r',
          color: 0x69f0ae,
          action: () => this.scene.start('GameScene'),
        }
      : {
          label: 'START',
          shortcut: 'enter',
          color: 0x69f0ae,
          action: () => this.scene.start('GameScene'),
        };
    this.actions = [
      firstAction,
      {
        label: 'STORE',
        shortcut: 's',
        color: 0xffd54f,
        action: () => this.scene.start('StoreScene', submenuData()),
      },
      {
        label: 'LOADOUT',
        shortcut: 'l',
        color: 0x4fc3f7,
        action: () => this.scene.start('LoadoutScene', submenuData()),
      },
      {
        label: 'MONSTERS',
        shortcut: 'm',
        color: 0xff7043,
        action: () => this.scene.start('MonstersScene'),
      },
      {
        label: 'SETTINGS',
        shortcut: 'o',
        color: 0xce93d8,
        action: () => this.scene.start('SettingsScene'),
      },
    ];

    this.createMenu(style);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.input.keyboard.on('keydown', this.onKey, this);
  }

  shutdown() {
    this.input.setDefaultCursor('default');
    this.input.keyboard.off('keydown', this.onKey, this);
  }

  createGameOverDetails(style) {
    const data = this.gameOverData;
    const walletSaved = data.walletSaved ?? Save.get().wallet;
    const lines = [
      { text: 'GAME OVER', y: 168, size: '34px', color: '#ff4242' },
      { text: `Wave reached: ${data.wave ?? 0}`, y: 230, size: '18px', color: '#ffffff' },
      { text: `Score: ${data.score ?? 0}`, y: 260, size: '18px', color: '#ffffff' },
      { text: `Coins earned: +${data.coinsEarned ?? 0}`, y: 292, size: '18px', color: '#ffd54f' },
      { text: `Wallet saved: ${walletSaved}`, y: 322, size: '16px', color: '#d0d0d0' },
    ];

    for (const line of lines) {
      this.add.text(62, line.y, line.text, {
        ...style,
        fontSize: line.size,
        color: line.color,
      });
    }
  }

  createMenu(style) {
    const x = 520;
    const y = 170;
    const width = 220;
    const height = 54;
    const gap = 16;

    this.actionViews = this.actions.map((action, index) => {
      const top = y + index * (height + gap);
      const container = this.add.container(x, top);
      const bg = this.add.graphics();
      const label = this.add
        .text(28, height / 2, action.label, {
          ...style,
          fontSize: '22px',
        })
        .setOrigin(0, 0.5);
      const shortcut = this.add
        .text(width - 24, height / 2, action.shortcut.toUpperCase(), {
          ...style,
          fontSize: '10px',
          color: '#999999',
        })
        .setOrigin(0.5);

      container.add([bg, label, shortcut]);
      container
        .setSize(width, height)
        .setInteractive(
          new Phaser.Geom.Rectangle(0, 0, width, height),
          Phaser.Geom.Rectangle.Contains,
        )
        .on('pointerover', () => {
          this.input.setDefaultCursor('pointer');
          this.selectAction(index);
        })
        .on('pointerout', () => this.input.setDefaultCursor('default'))
        .on('pointerdown', () => this.activateAction(index));

      return { container, bg, label, shortcut };
    });

    this.add
      .text(
        x + width / 2,
        y + this.actions.length * (height + gap) + 10,
        'click or use arrows + enter',
        {
          ...style,
          fontSize: '12px',
          color: '#cccccc',
        },
      )
      .setOrigin(0.5);

    this.selectAction(0);
  }

  onKey(event) {
    const k = event.key?.toLowerCase();
    if (
      [
        'arrowup',
        'arrowleft',
        'arrowdown',
        'arrowright',
        'enter',
        ' ',
        'r',
        's',
        'l',
        'm',
        'o',
      ].includes(k) ||
      event.code === 'Space'
    ) {
      event.preventDefault?.();
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft')
      this.selectAction(this.actionIndex - 1);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowRight')
      this.selectAction(this.actionIndex + 1);
    else if (event.key === 'Enter' || event.key === ' ' || event.code === 'Space')
      this.activateAction(this.actionIndex);
    else if (k === 'r' && this.gameOverData) this.scene.start('GameScene');
    else if (k === 's')
      this.scene.start('StoreScene', {
        returnScene: 'MainMenuScene',
        ...(this.gameOverData || {}),
      });
    else if (k === 'l')
      this.scene.start('LoadoutScene', {
        returnScene: 'MainMenuScene',
        ...(this.gameOverData || {}),
      });
    else if (k === 'm') this.scene.start('MonstersScene');
    else if (k === 'o') this.scene.start('SettingsScene');
  }

  selectAction(index) {
    this.actionIndex = Phaser.Math.Wrap(index, 0, this.actions.length);
    this.actionViews.forEach((view, i) => {
      const selected = i === this.actionIndex;
      const action = this.actions[i];
      view.bg.clear();
      view.bg.fillStyle(0x101710, selected ? 0.96 : 0.78);
      view.bg.fillRoundedRect(0, 0, 220, 54, 8);
      view.bg.lineStyle(selected ? 4 : 2, action.color, 1);
      view.bg.strokeRoundedRect(0, 0, 220, 54, 8);
      if (selected) {
        view.bg.fillStyle(action.color, 1);
        view.bg.fillTriangle(-16, 27, -5, 20, -5, 34);
      }
      view.label.setColor(selected ? '#ffffff' : '#dddddd');
      view.shortcut.setColor(selected ? '#ffffff' : '#aaaaaa');
      view.container.setScale(selected ? 1.03 : 1);
    });
  }

  activateAction(index) {
    this.input.setDefaultCursor('default');
    this.actions[index]?.action();
  }
}
