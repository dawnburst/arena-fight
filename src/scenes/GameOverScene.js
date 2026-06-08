import Phaser from 'phaser';
import { CFG } from '../config.js';
import { Save } from '../save.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.finalScore = data?.score ?? 0;
    this.finalWave = data?.wave ?? 1;
    this.coinsEarned = data?.coinsEarned ?? 0;

    // Persist run results once per arrival from gameplay.
    // If we arrive from Store/Loadout back-button, data.persisted is set so we skip.
    if (!data?.persisted) {
      this.walletBefore = Save.get().wallet;
      Save.recordRun({
        wave: this.finalWave,
        score: this.finalScore,
        coinsEarned: this.coinsEarned,
      });
      this.walletAfter = Save.get().wallet;
    } else {
      this.walletBefore = Save.get().wallet;
      this.walletAfter = this.walletBefore;
    }
  }

  create() {
    const cy = CFG.arena.height / 2;
    const style = {
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      color: '#ffffff',
    };

    this.add
      .text(70, cy - 145, 'GAME OVER', { ...style, fontSize: '48px', color: '#e53935' })
      .setOrigin(0, 0.5);

    this.add
      .text(74, cy - 78, `Wave reached: ${this.finalWave}`, { ...style, fontSize: '20px' })
      .setOrigin(0, 0.5);
    this.add
      .text(74, cy - 50, `Score: ${this.finalScore}`, { ...style, fontSize: '20px' })
      .setOrigin(0, 0.5);
    this.add
      .text(74, cy - 20, `Coins earned: +${this.coinsEarned}`, { ...style, fontSize: '18px', color: '#ffd54f' })
      .setOrigin(0, 0.5);
    this.add
      .text(74, cy + 8, `Wallet: ${this.walletBefore} -> ${this.walletAfter}`, { ...style, fontSize: '16px', color: '#bbbbbb' })
      .setOrigin(0, 0.5);

    this.passthroughData = {
      score: this.finalScore,
      wave: this.finalWave,
      coinsEarned: this.coinsEarned,
      persisted: true,
    };

    this.actionIndex = 0;
    this.actionButtons = [
      {
        label: 'STORE',
        shortcut: 's',
        borderColor: 0xffd54f,
        bgColor: 0x241f16,
        action: () => this.scene.start('StoreScene', this.passthroughData),
        icon: (graphics) => this.drawStoreIcon(graphics),
      },
      {
        label: 'LOADOUT',
        shortcut: 'l',
        borderColor: 0x4fc3f7,
        bgColor: 0x121f24,
        action: () => this.scene.start('LoadoutScene', this.passthroughData),
        icon: (graphics) => this.drawLoadoutIcon(graphics),
      },
      {
        label: 'RETRY',
        shortcut: 'r',
        borderColor: 0x69f0ae,
        bgColor: 0x132417,
        action: () => this.scene.start('GameScene'),
        icon: (graphics) => this.drawRetryIcon(graphics),
      },
      {
        label: 'MENU',
        shortcut: 'm',
        borderColor: 0xce93d8,
        bgColor: 0x211827,
        action: () => this.scene.start('MainMenuScene'),
        icon: (graphics) => this.drawMenuIcon(graphics),
      },
    ];

    this.createActionMenu(style);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.input.keyboard.on('keydown', this.onKey, this);
  }

  shutdown() {
    this.input.setDefaultCursor('default');
    this.input.keyboard.off('keydown', this.onKey, this);
  }

  onKey(event) {
    const k = event.key?.toLowerCase();
    const handledKeys = ['r', 's', 'l', 'm', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', 'enter', ' '];
    if (handledKeys.includes(k) || event.code === 'Space') {
      event.preventDefault();
    }

    if (k === 'r') {
      this.activateAction(2);
    } else if (k === 's') {
      this.activateAction(0);
    } else if (k === 'l') {
      this.activateAction(1);
    } else if (k === 'm') {
      this.activateAction(3);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      this.selectAction(this.actionIndex - 1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      this.selectAction(this.actionIndex + 1);
    } else if (event.key === 'Enter' || event.key === ' ' || event.code === 'Space') {
      this.activateAction(this.actionIndex);
    }
  }

  createActionMenu(style) {
    const buttonX = 490;
    const buttonY = 130;
    const buttonWidth = 250;
    const buttonHeight = 64;
    const buttonGap = 20;

    this.actionButtonViews = this.actionButtons.map((button, index) => {
      const top = buttonY + index * (buttonHeight + buttonGap);
      const container = this.add.container(buttonX, top);
      const background = this.add.graphics();
      const icon = this.add.graphics();
      const label = this.add.text(76, buttonHeight / 2, button.label, {
        ...style,
        fontSize: '22px',
      }).setOrigin(0, 0.5);
      const shortcut = this.add.text(buttonWidth - 24, buttonHeight / 2, button.shortcut.toUpperCase(), {
        ...style,
        fontSize: '12px',
        color: '#888888',
      }).setOrigin(0.5);

      icon.setPosition(36, buttonHeight / 2);
      button.icon(icon);

      container.add([background, icon, label, shortcut]);
      container
        .setSize(buttonWidth, buttonHeight)
        .setInteractive(new Phaser.Geom.Rectangle(0, 0, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains)
        .on('pointerover', () => {
          this.input.setDefaultCursor('pointer');
          this.selectAction(index);
        })
        .on('pointerout', () => this.input.setDefaultCursor('default'))
        .on('pointerdown', () => this.activateAction(index));

      return { container, background, icon, label, shortcut };
    });

    this.add
      .text(buttonX + buttonWidth / 2, buttonY + this.actionButtons.length * (buttonHeight + buttonGap) + 14, 'click or use arrows + enter', {
        ...style,
        fontSize: '12px',
        color: '#666666',
      })
      .setOrigin(0.5);

    this.selectAction(0);
  }

  selectAction(index) {
    this.actionIndex = Phaser.Math.Wrap(index, 0, this.actionButtons.length);
    this.actionButtonViews.forEach((view, i) => {
      this.drawActionButton(view.background, this.actionButtons[i], i === this.actionIndex);
      view.label.setColor(i === this.actionIndex ? '#ffffff' : '#dddddd');
      view.shortcut.setColor(i === this.actionIndex ? '#bbbbbb' : '#777777');
      view.container.setScale(i === this.actionIndex ? 1.03 : 1);
    });
  }

  activateAction(index) {
    this.input.setDefaultCursor('default');
    this.actionButtons[index]?.action();
  }

  drawActionButton(graphics, button, selected) {
    graphics.clear();
    graphics.fillStyle(button.bgColor, selected ? 1 : 0.78);
    graphics.fillRoundedRect(0, 0, 250, 64, 10);
    graphics.lineStyle(selected ? 4 : 3, button.borderColor, 1);
    graphics.strokeRoundedRect(0, 0, 250, 64, 10);

    if (selected) {
      graphics.fillStyle(button.borderColor, 1);
      graphics.fillTriangle(-18, 32, -6, 24, -6, 40);
    }
  }

  drawStoreIcon(graphics) {
    graphics.lineStyle(3, 0xffffff, 1);
    graphics.beginPath();
    graphics.moveTo(-11, -2);
    graphics.lineTo(0, -12);
    graphics.lineTo(11, -2);
    graphics.lineTo(11, 11);
    graphics.lineTo(-11, 11);
    graphics.closePath();
    graphics.strokePath();

    graphics.fillStyle(0xe53935, 1);
    graphics.fillRect(-3, 3, 6, 8);
  }

  drawLoadoutIcon(graphics) {
    graphics.lineStyle(3, 0xffffff, 1);
    graphics.beginPath();
    graphics.moveTo(0, -13);
    graphics.lineTo(13, 0);
    graphics.lineTo(0, 13);
    graphics.lineTo(-13, 0);
    graphics.closePath();
    graphics.strokePath();

    graphics.lineStyle(2, 0x4fc3f7, 0.85);
    graphics.lineBetween(-5, 0, 5, 0);
  }

  drawRetryIcon(graphics) {
    graphics.lineStyle(3, 0xffffff, 1);
    graphics.beginPath();
    graphics.arc(0, 0, 11, Phaser.Math.DegToRad(30), Phaser.Math.DegToRad(330), false);
    graphics.strokePath();

    graphics.fillStyle(0xffffff, 1);
    graphics.fillTriangle(8, -14, 15, -12, 11, -5);
    graphics.lineStyle(3, 0xffffff, 1);
    graphics.lineBetween(-10, -12, -10, -4);
    graphics.lineBetween(-10, -12, -3, -12);
  }

  drawMenuIcon(graphics) {
    graphics.lineStyle(3, 0xffffff, 1);
    graphics.strokeRoundedRect(-12, -12, 24, 24, 3);
    graphics.lineStyle(2, 0xce93d8, 1);
    graphics.lineBetween(-6, -5, 6, -5);
    graphics.lineBetween(-6, 0, 6, 0);
    graphics.lineBetween(-6, 5, 6, 5);
  }
}
