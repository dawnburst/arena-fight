import Phaser from 'phaser';
import {
  ACHIEVEMENT_TIER_COUNT,
  ACHIEVEMENT_TIERS,
  achievementBadgeKey,
  achievementBadgePath,
  CATEGORIES,
  playerLevel,
  tierProgress,
  unlockedPoints,
} from '../achievements.js';
import { playSfx, preloadSfx } from '../audio.js';
import {
  ARENA_BACKGROUNDS,
  backgroundKey,
  backgroundPath,
  resolveBackground,
} from '../backgrounds.js';
import { CFG } from '../config.js';
import { Save } from '../save.js';
import { addBadge, addTouchButton, coverBackground, isTouchMode } from './sceneUtils.js';

const FONT = 'ui-monospace, Menlo, Consolas, monospace';
const COLS = 4;
const CELL_W = 180;
const CELL_H = 122;
const BADGE_SIZE = 72;

export default class AchievementsScene extends Phaser.Scene {
  constructor() {
    super('AchievementsScene');
  }

  preload() {
    // Badge images (one per tier). Missing files fall back to a drawn medallion.
    for (const tier of ACHIEVEMENT_TIERS) {
      const key = achievementBadgeKey(tier.tierId);
      if (!this.textures.exists(key)) {
        this.load.image(key, achievementBadgePath(tier.tierId));
      }
    }
    // The gallery background reuses the player's selected arena.
    for (const background of ARENA_BACKGROUNDS) {
      const key = backgroundKey(background.id);
      if (!this.textures.exists(key)) {
        this.load.image(key, backgroundPath(background));
      }
    }
    preloadSfx(this);
  }

  create() {
    this.categoryIndex = 0;
    this.selectedIndex = 0;
    this.popup = null;

    const style = { fontFamily: FONT, color: '#ffffff' };
    const selectedBackground = resolveBackground(Save.get().settings?.backgroundId);
    coverBackground(this, backgroundKey(selectedBackground.id)).setDepth(-20);
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.55).setOrigin(0);

    this.add.text(20, 14, 'ACHIEVEMENTS', { ...style, fontSize: '28px', color: '#ffd54f' });

    const save = Save.get();
    const unlocked = (save.achievements || []).length;
    const points = unlockedPoints(save.achievements);
    const pct = Math.round((unlocked / ACHIEVEMENT_TIER_COUNT) * 100);
    const level = playerLevel(points, CFG.achievements?.pointsPerLevel ?? 100);
    this.add
      .text(this.scale.width - 20, 16, `Lv ${level}  ·  ${points} pts`, {
        ...style,
        fontSize: '16px',
        color: '#ffe082',
      })
      .setOrigin(1, 0);
    this.add
      .text(this.scale.width - 20, 38, `${unlocked} / ${ACHIEVEMENT_TIER_COUNT}  (${pct}%)`, {
        ...style,
        fontSize: '14px',
        color: '#d7c4f5',
      })
      .setOrigin(1, 0);

    this.createTabs(style);

    this.gridGroup = this.add.container(0, 0);

    this.hintText = this.add.text(
      20,
      this.scale.height - 22,
      '←/→/↑/↓ select  •  enter details  •  tab switch  •  B back',
      { ...style, fontSize: '12px', color: '#888' },
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.input.keyboard.on('keydown', this.onKey, this);
    this.onResize = () => this.scene.restart(this.scene.settings.data);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);

    this.createTouchControls();
    this.refresh();
  }

  createTabs(style) {
    this.tabTexts = CATEGORIES.map((cat, i) => {
      const t = this.add
        .text(20 + i * 150, 56, cat.name, { ...style, fontSize: '15px' })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.setCategory(i));
      return t;
    });
  }

  createTouchControls() {
    if (!isTouchMode()) return;
    addTouchButton(this, {
      x: this.scale.width - 138,
      y: 52,
      width: 124,
      height: 44,
      label: '‹ BACK',
      onClick: () => this.back(),
    });
  }

  // Tiers belonging to the active category tab.
  currentTiers() {
    const catId = CATEGORIES[this.categoryIndex].id;
    return ACHIEVEMENT_TIERS.filter((t) => t.category === catId);
  }

  setCategory(index) {
    const next = Phaser.Math.Wrap(index, 0, CATEGORIES.length);
    if (next === this.categoryIndex) return;
    playSfx(this, 'uiMove');
    this.categoryIndex = next;
    this.selectedIndex = 0;
    this.refresh();
  }

  refresh() {
    this.gridGroup.removeAll(true);
    const unlockedSet = new Set(Save.get().achievements || []);
    const tiers = this.currentTiers();
    this.selectedIndex = Phaser.Math.Clamp(this.selectedIndex, 0, Math.max(0, tiers.length - 1));

    const gridLeft = (this.scale.width - COLS * CELL_W) / 2;
    const startY = 110;

    CATEGORIES.forEach((cat, i) => {
      const active = i === this.categoryIndex;
      this.tabTexts[i].setText(active ? `[ ${cat.name} ]` : cat.name);
      this.tabTexts[i].setColor(active ? '#ffd54f' : '#bbbbbb');
    });

    tiers.forEach((tier, index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const cx = gridLeft + CELL_W / 2 + col * CELL_W;
      const cy = startY + CELL_H / 2 + row * CELL_H;
      const unlocked = unlockedSet.has(tier.tierId);
      const selected = index === this.selectedIndex;

      const frame = this.add.graphics();
      frame.fillStyle(0x101710, selected ? 0.9 : 0.55);
      frame.fillRoundedRect(cx - CELL_W / 2 + 6, cy - CELL_H / 2 + 4, CELL_W - 12, CELL_H - 8, 8);
      frame.lineStyle(selected ? 3 : 1, selected ? 0xffd54f : 0x445544, 1);
      frame.strokeRoundedRect(cx - CELL_W / 2 + 6, cy - CELL_H / 2 + 4, CELL_W - 12, CELL_H - 8, 8);
      this.gridGroup.add(frame);

      const badge = addBadge(this, cx, cy - 16, tier, { size: BADGE_SIZE, unlocked });
      this.gridGroup.add(badge);

      if (!unlocked) {
        const lock = this.add
          .text(cx + BADGE_SIZE / 2 - 6, cy - 16 - BADGE_SIZE / 2 + 6, '🔒', { fontSize: '18px' })
          .setOrigin(0.5);
        this.gridGroup.add(lock);
      }

      const label = tier.label ? `${tier.name}` : tier.name;
      const nameText = this.add
        .text(cx, cy + 30, label, {
          fontFamily: FONT,
          fontSize: '13px',
          color: unlocked ? '#ffffff' : '#888888',
        })
        .setOrigin(0.5);
      this.gridGroup.add(nameText);
      if (tier.label) {
        const tierText = this.add
          .text(cx, cy + 46, tier.label, {
            fontFamily: FONT,
            fontSize: '11px',
            color: unlocked ? Phaser.Display.Color.IntegerToColor(tier.color).rgba : '#777777',
          })
          .setOrigin(0.5);
        this.gridGroup.add(tierText);
      }

      const zone = this.add
        .zone(cx, cy, CELL_W, CELL_H)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          if (this.selectedIndex === index) return;
          this.selectedIndex = index;
          // Defer: refresh() destroys this zone, which is mid-event right now.
          this.time.delayedCall(0, () => this.refresh());
        })
        .on('pointerdown', () => this.openDetail(index));
      this.gridGroup.add(zone);
    });
  }

  openDetail(index) {
    const tiers = this.currentTiers();
    const tier = tiers[index];
    if (!tier) return;
    this.selectedIndex = index;
    playSfx(this, 'uiConfirm');
    this.closeDetail();

    const save = Save.get();
    const unlocked = new Set(save.achievements || []).has(tier.tierId);
    const ctx = { stats: save.stats, save };
    const prog = tierProgress(ctx, tier);

    const container = this.add.container(0, 0).setDepth(2000);
    const blocker = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.7)
      .setOrigin(0)
      .setInteractive()
      .on('pointerdown', () => this.closeDetail());
    container.add(blocker);

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const panelW = 520;
    const panelH = 320;
    const panel = this.add.graphics();
    panel.fillStyle(0x12161a, 0.98);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    panel.lineStyle(2, unlocked ? tier.color : 0x556655, 1);
    panel.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    container.add(panel);

    const badge = addBadge(this, cx, cy - panelH / 2 + 78, tier, { size: 120, unlocked });
    container.add(badge);

    const title = tier.label ? `${tier.name} — ${tier.label}` : tier.name;
    container.add(
      this.add
        .text(cx, cy - 4, title, {
          fontFamily: FONT,
          fontSize: '22px',
          color: unlocked ? '#ffffff' : '#bbbbbb',
        })
        .setOrigin(0.5),
    );
    container.add(
      this.add
        .text(cx, cy + 26, tier.description || '', {
          fontFamily: FONT,
          fontSize: '14px',
          color: '#cccccc',
          align: 'center',
          wordWrap: { width: panelW - 60 },
        })
        .setOrigin(0.5),
    );

    // Progress bar.
    const barW = panelW - 120;
    const barY = cy + 70;
    const bar = this.add.graphics();
    bar.fillStyle(0x000000, 0.6);
    bar.fillRoundedRect(cx - barW / 2, barY, barW, 16, 8);
    bar.fillStyle(unlocked ? 0x69f0ae : tier.color, 1);
    const fillW = Math.max(prog.ratio > 0 ? 8 : 0, barW * prog.ratio);
    if (fillW > 0) bar.fillRoundedRect(cx - barW / 2, barY, fillW, 16, 8);
    container.add(bar);
    container.add(
      this.add
        .text(
          cx,
          barY + 28,
          unlocked
            ? `UNLOCKED · +${tier.points} pts`
            : `${prog.current.toLocaleString()} / ${prog.target.toLocaleString()}  ·  +${tier.points} pts`,
          {
            fontFamily: FONT,
            fontSize: '13px',
            color: unlocked ? '#69f0ae' : '#ffe082',
          },
        )
        .setOrigin(0.5),
    );
    container.add(
      this.add
        .text(cx, cy + panelH / 2 - 22, 'tap / B to close', {
          fontFamily: FONT,
          fontSize: '12px',
          color: '#777',
        })
        .setOrigin(0.5),
    );

    this.popup = container;
  }

  closeDetail() {
    if (this.popup) {
      this.popup.destroy(true);
      this.popup = null;
    }
  }

  back() {
    playSfx(this, 'uiCancel');
    const data = this.scene.settings.data || {};
    this.scene.start(data.returnScene || 'MainMenuScene', data);
  }

  onKey(event) {
    const k = event.key?.toLowerCase();
    if (this.popup) {
      if (k === 'escape' || k === 'b' || k === 'enter' || k === ' ') this.closeDetail();
      return;
    }
    const tiers = this.currentTiers();
    if (event.key === 'ArrowRight') this.moveSelection(1);
    else if (event.key === 'ArrowLeft') this.moveSelection(-1);
    else if (event.key === 'ArrowDown') this.moveSelection(COLS);
    else if (event.key === 'ArrowUp') this.moveSelection(-COLS);
    else if (event.key === 'Tab') {
      event.preventDefault?.();
      this.setCategory(this.categoryIndex + (event.shiftKey ? -1 : 1));
    } else if (k === 'enter' || k === ' ') this.openDetail(this.selectedIndex);
    else if (k === 'escape' || k === 'b') this.back();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k))
      event.preventDefault?.();
    void tiers;
  }

  moveSelection(delta) {
    const count = this.currentTiers().length;
    if (!count) return;
    const next = Phaser.Math.Clamp(this.selectedIndex + delta, 0, count - 1);
    if (next !== this.selectedIndex) {
      this.selectedIndex = next;
      playSfx(this, 'uiMove');
      this.refresh();
    }
  }

  shutdown() {
    this.closeDetail();
    this.input.keyboard.off('keydown', this.onKey, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
  }
}
