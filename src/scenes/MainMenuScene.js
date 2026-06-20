import Phaser from 'phaser';
import { ACHIEVEMENT_COUNT, ACHIEVEMENTS_BY_ID } from '../achievements.js';
import { playSfx, preloadMusic, preloadSfx, syncMusic } from '../audio.js';
import {
  ARENA_BACKGROUNDS,
  backgroundKey,
  backgroundPath,
  resolveBackground,
} from '../backgrounds.js';
import { ENEMY_BESTIARY } from '../enemies.js';
import { Save } from '../save.js';
import { coverBackground } from './sceneUtils.js';

// enemy `type` string → display name for the run-summary kills breakdown.
const ENEMY_LABELS = {
  ...Object.fromEntries(ENEMY_BESTIARY.map((e) => [e.id, e.name])),
  'splitter-child': 'Splitling',
};

function enemyLabel(type) {
  return ENEMY_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function formatDuration(ms) {
  const total = Math.floor((ms || 0) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

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
    preloadSfx(this);
  }

  create() {
    syncMusic(this);
    const style = {
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      color: '#ffffff',
    };
    const selectedBackground = resolveBackground(Save.get().settings?.backgroundId);

    coverBackground(this, backgroundKey(selectedBackground.id)).setDepth(-20);
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.34).setOrigin(0);

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

    this.add.text(62, this.scale.height - 46, `Arena: ${selectedBackground.name}`, {
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
        label: 'TUTORIAL',
        shortcut: 't',
        color: 0x80d8ff,
        action: () => this.scene.start('GameScene', { tutorial: true }),
      },
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

    // Stateless menu: rebuild on a mobile rotate / fullscreen toggle to relayout.
    this.onResize = () => this.scene.restart(this.gameOverData || undefined);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
  }

  shutdown() {
    this.input.setDefaultCursor('default');
    this.input.keyboard.off('keydown', this.onKey, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
  }

  createGameOverDetails(style) {
    const data = this.gameOverData;
    const summary = data.summary || {};
    const walletSaved = data.walletSaved ?? Save.get().wallet;

    this.add.text(62, 158, 'GAME OVER', {
      ...style,
      fontSize: '30px',
      color: '#ff4242',
    });

    // Two-column stat grid: left col x=62, right col x=300.
    const fired = summary.shotsFired ?? 0;
    const accuracy = fired > 0 ? `${Math.round(((summary.shotsHit ?? 0) / fired) * 100)}%` : '—';
    const rows = [
      [`Wave reached: ${data.wave ?? 0}`, `Score: ${data.score ?? 0}`],
      [`Time: ${formatDuration(summary.durationMs)}`, `Coins: +${data.coinsEarned ?? 0}`],
      [`Longest combo: x${summary.longestCombo ?? 1}`, `Accuracy: ${accuracy}`],
      [`Enemies slain: ${summary.kills ?? 0}`, `Bosses: ${summary.bosses ?? 0}`],
    ];
    const statStyle = { ...style, fontSize: '15px', color: '#eeeeee' };
    rows.forEach(([left, right], i) => {
      const y = 204 + i * 24;
      this.add.text(62, y, left, statStyle);
      this.add.text(290, y, right, statStyle);
    });

    // Kills-by-type breakdown (only types actually killed), word-wrapped.
    const byType = summary.killsByType || {};
    const parts = Object.entries(byType)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([type, n]) => `${enemyLabel(type)} ${n}`);
    let nextY = 304;
    if (parts.length) {
      this.add.text(62, nextY, 'Kills by type', { ...style, fontSize: '13px', color: '#ffd54f' });
      this.add.text(62, nextY + 18, parts.join('   '), {
        ...style,
        fontSize: '12px',
        color: '#bdbdbd',
        wordWrap: { width: 446 },
      });
      nextY += 18 + 18 * Math.ceil(parts.length / 5);
    }

    // Newly unlocked achievements (gold), then lifetime progress + wallet.
    const unlocked = data.newAchievements || [];
    nextY = Math.max(nextY, 360);
    if (unlocked.length) {
      this.add.text(62, nextY, '🏆 Achievement unlocked!', {
        ...style,
        fontSize: '15px',
        color: '#ffd54f',
      });
      unlocked.forEach((id, i) => {
        const ach = ACHIEVEMENTS_BY_ID[id];
        if (!ach) return;
        this.add.text(78, nextY + 22 + i * 20, `• ${ach.name} — ${ach.description}`, {
          ...style,
          fontSize: '12px',
          color: '#ffe082',
        });
      });
      nextY += 22 + unlocked.length * 20 + 6;
    }

    const totalUnlocked = (Save.get().achievements || []).length;
    this.add.text(
      62,
      this.scale.height - 84,
      `Achievements: ${totalUnlocked} / ${ACHIEVEMENT_COUNT}`,
      {
        ...style,
        fontSize: '14px',
        color: '#d7c4f5',
      },
    );
    this.add.text(62, this.scale.height - 66, `Wallet saved: ${walletSaved}`, {
      ...style,
      fontSize: '14px',
      color: '#d0d0d0',
    });
  }

  createMenu(style) {
    // Right-anchored so the column keeps its ~60px right margin on a wider mobile
    // canvas (x = 520 on the desktop 800-wide canvas — identical there).
    const x = this.scale.width - 280;
    const width = 220;
    // Fit the column on the fixed 600px-tall canvas: with 6+ actions, tighten
    // the row height/gap and raise the top so the bottom row and the help line
    // below it never clip off-screen.
    const compact = this.actions.length > 5;
    const y = compact ? 150 : 170;
    const height = compact ? 46 : 54;
    const gap = compact ? 12 : 16;
    this.menuRow = { width, height };

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
      // Use a dedicated Zone matching the button's exact on-screen rectangle so
      // hover/click hit-testing is accurate (independent of container scaling).
      this.add
        .zone(x, top, width, height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
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
        't',
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
    else if (k === 't') this.scene.start('GameScene', { tutorial: true });
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
    const next = Phaser.Math.Wrap(index, 0, this.actions.length);
    if (next !== this.actionIndex) playSfx(this, 'uiMove');
    this.actionIndex = next;
    this.actionViews.forEach((view, i) => {
      const selected = i === this.actionIndex;
      const action = this.actions[i];
      const rw = this.menuRow?.width ?? 220;
      const rh = this.menuRow?.height ?? 54;
      view.bg.clear();
      view.bg.fillStyle(0x101710, selected ? 0.96 : 0.78);
      view.bg.fillRoundedRect(0, 0, rw, rh, 8);
      view.bg.lineStyle(selected ? 4 : 2, action.color, 1);
      view.bg.strokeRoundedRect(0, 0, rw, rh, 8);
      if (selected) {
        view.bg.fillStyle(action.color, 1);
        view.bg.fillTriangle(-16, rh / 2, -5, rh / 2 - 7, -5, rh / 2 + 7);
      }
      view.label.setColor(selected ? '#ffffff' : '#dddddd');
      view.shortcut.setColor(selected ? '#ffffff' : '#aaaaaa');
      view.container.setScale(selected ? 1.03 : 1);
    });
  }

  activateAction(index) {
    this.input.setDefaultCursor('default');
    playSfx(this, 'uiConfirm');
    this.actions[index]?.action();
  }
}
