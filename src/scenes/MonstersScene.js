import Phaser from 'phaser';
import { playSfx, preloadSfx } from '../audio.js';
import { CFG } from '../config.js';
import { ENEMY_BESTIARY, ENEMY_SPRITES } from '../enemies.js';
import { addTouchButton, isTouchMode } from './sceneUtils.js';

const STYLE = {
  fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  color: '#ffffff',
};

const CARD_W = 140;
const CARD_H = 132;

// Bosses are split out of the flat gallery into their own sub-screen. They are
// identified by id (the bestiary order is otherwise authoritative).
const isBossId = (id) => typeof id === 'string' && id.startsWith('boss');
const REGULAR_MONSTERS = ENEMY_BESTIARY.filter((e) => !isBossId(e.id));
const BOSS_MONSTERS = ENEMY_BESTIARY.filter((e) => isBossId(e.id));
// Synthetic entry that stands in for the whole boss roster on the main grid.
const BOSSES_TILE = { bossesTile: true, name: 'BOSSES' };

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
    preloadSfx(this);
  }

  create() {
    this.mode = 'gallery';
    this.detailReturn = 'gallery';
    this.detailEntry = null;

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x111511, 1).setOrigin(0);
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x234022, 0.18).setOrigin(0);

    this.title = this.add.text(28, 20, 'MONSTERS', { ...STYLE, fontSize: '30px' });
    this.subtitle = this.add.text(30, 58, 'select a monster to inspect its power', {
      ...STYLE,
      fontSize: '13px',
      color: '#b9d7b3',
    });

    this.gallery = this.add.container(0, 0);
    this.bossGallery = this.add.container(0, 0).setVisible(false);
    this.detail = this.add.container(0, 0).setVisible(false);

    // Main grid lists every regular monster plus a single distinct BOSSES tile.
    this.mainGrid = this.createGrid(this.gallery, [...REGULAR_MONSTERS, BOSSES_TILE]);
    this.bossGrid = this.createGrid(this.bossGallery, BOSS_MONSTERS);
    this.createDetail();

    this.activeGrid = this.mainGrid;

    this.hint = this.add
      .text(
        this.scale.width / 2,
        this.scale.height - 28,
        'arrows select  •  enter inspect  •  B / Esc back',
        { ...STYLE, fontSize: '12px', color: '#b7c7b3' },
      )
      .setOrigin(0.5);

    this.input.keyboard.on('keydown', this.onKey, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    // Stateless grids: rebuild on a mobile rotate / fullscreen toggle.
    this.onResize = () => this.scene.restart();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);

    this.createTouchControls();
    this.setGridZones(this.bossGrid, false);
    this.refreshGrid(this.mainGrid);
  }

  // Touch BACK: cards already tap to inspect and the detail screen has a tappable
  // demo button, so a single context-aware BACK is all that's missing.
  createTouchControls() {
    if (!isTouchMode()) return;
    addTouchButton(this, {
      x: this.scale.width - 138,
      y: 24,
      width: 124,
      height: 46,
      label: '‹ BACK',
      onClick: () => this.back(),
    });
  }

  // Back walks one level at a time: detail -> its grid -> main grid -> menu.
  back() {
    playSfx(this, 'uiCancel');
    if (this.mode === 'detail') {
      if (this.detailReturn === 'bossGallery') this.showBossGallery();
      else this.showGallery();
    } else if (this.mode === 'bossGallery') {
      this.showGallery();
    } else {
      this.scene.start('MainMenuScene');
    }
  }

  shutdown() {
    this.input.setDefaultCursor('default');
    this.input.keyboard.off('keydown', this.onKey, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
  }

  // A boss "has art" only when its sprite sheet actually loaded; missing art
  // (future bosses with no picture yet) renders a blank portrait automatically.
  hasArt(entry) {
    const def = ENEMY_SPRITES[entry.sprite];
    return !!def && this.textures.exists(def.key);
  }

  createGrid(parent, entries) {
    const startX = 26;
    const startY = 96;
    const gap = 12;
    const rowGap = 16;
    const columns = 5;

    const grid = { entries, cards: [], zones: [], index: 0, container: parent };

    entries.forEach((entry, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + col * (CARD_W + gap);
      const y = startY + row * (CARD_H + rowGap);
      const container = this.add.container(x, y);
      const bg = this.add.graphics();
      const children = [bg];
      let name = null;

      if (entry.bossesTile) {
        const icon = this.add
          .text(CARD_W / 2, 48, '☠', { ...STYLE, fontSize: '48px', color: '#ff6e6e' })
          .setOrigin(0.5);
        name = this.add
          .text(CARD_W / 2, 92, 'BOSSES', { ...STYLE, fontSize: '17px', color: '#ffd54f' })
          .setOrigin(0.5);
        const count = this.add
          .text(CARD_W / 2, 114, `${BOSS_MONSTERS.length} bosses`, {
            ...STYLE,
            fontSize: '11px',
            color: '#b9d7b3',
          })
          .setOrigin(0.5);
        children.push(icon, name, count);
      } else {
        if (this.hasArt(entry)) {
          const def = ENEMY_SPRITES[entry.sprite];
          const portrait = this.add
            .sprite(CARD_W / 2, 46, def.key, entry.frame)
            .setScale(entry.galleryScale ?? 0.7);
          if (entry.tint) portrait.setTint(entry.tint);
          children.push(portrait);
        }
        name = this.add
          .text(CARD_W / 2, 86, entry.name, { ...STYLE, fontSize: '13px' })
          .setOrigin(0.5);
        const wave = this.add
          .text(CARD_W / 2, 104, entry.firstWave, {
            ...STYLE,
            fontSize: '11px',
            color: '#ffd54f',
          })
          .setOrigin(0.5);
        const hp = this.add
          .text(CARD_W / 2, 120, `HP ${enemyMaxHp(entry.id)}`, {
            ...STYLE,
            fontSize: '11px',
            color: '#ff8a80',
          })
          .setOrigin(0.5);
        children.push(name, wave, hp);
      }

      container.add(children);
      parent.add(container);

      // Dedicated Zone matching the card's exact on-screen rectangle so the
      // cursor always selects the card it is actually over.
      const zone = this.add
        .zone(x, y, CARD_W, CARD_H)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          this.input.setDefaultCursor('pointer');
          grid.index = index;
          this.refreshGrid(grid);
        })
        .on('pointerout', () => this.input.setDefaultCursor('default'))
        .on('pointerdown', () => this.activate(grid, index));

      grid.zones.push(zone);
      grid.cards.push({ container, bg, name });
    });

    return grid;
  }

  createDetail() {
    this.detailBg = this.add.graphics();
    this.detailPortrait = this.add.sprite(190, 230, ENEMY_SPRITES.monster.key, 0).setScale(3.1);
    this.detailNoArt = this.add
      .text(190, 230, 'NO IMAGE', { ...STYLE, fontSize: '14px', color: '#6f836b' })
      .setOrigin(0.5)
      .setVisible(false);
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

    // "Demo" button under the portrait (hidden for bosses).
    this.demoBtnBg = this.add.graphics();
    this.demoBtnLabel = this.add
      .text(190, 404, '▶ DEMO', { ...STYLE, fontSize: '18px', color: '#0b0f0b' })
      .setOrigin(0.5);
    this.demoButton = this.add
      .zone(110, 384, 160, 40)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.input.setDefaultCursor('pointer'))
      .on('pointerout', () => this.input.setDefaultCursor('default'))
      .on('pointerdown', () => this.openDemo());

    this.detail.add([
      this.detailBg,
      this.detailPortrait,
      this.detailNoArt,
      this.detailName,
      this.detailWave,
      this.detailHp,
      this.detailMovement,
      this.detailPower,
      this.detailCounter,
      this.demoBtnBg,
      this.demoBtnLabel,
      this.demoButton,
    ]);
  }

  openDemo() {
    const enemy = this.detailEntry;
    if (!enemy || isBossId(enemy.id)) return;
    this.scene.start('GameScene', {
      demo: true,
      demoEnemyId: enemy.id,
      returnScene: 'MonstersScene',
    });
  }

  onKey(event) {
    const k = event.key?.toLowerCase();
    if (
      ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'enter', ' ', 'b', 'escape'].includes(
        k,
      ) ||
      event.code === 'Space'
    ) {
      event.preventDefault?.();
    }

    if (this.mode === 'detail') {
      if (k === 'b' || event.key === 'Escape') this.back();
      return;
    }

    if (k === 'b' || event.key === 'Escape') this.back();
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') this.selectActive(-1);
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') this.selectActive(1);
    else if (event.key === 'Enter' || event.key === ' ' || event.code === 'Space')
      this.activate(this.activeGrid, this.activeGrid.index);
  }

  selectActive(delta) {
    const grid = this.activeGrid;
    const next = Phaser.Math.Wrap(grid.index + delta, 0, grid.entries.length);
    if (next !== grid.index) playSfx(this, 'uiMove');
    grid.index = next;
    this.refreshGrid(grid);
  }

  refreshGrid(grid) {
    grid.cards.forEach((card, index) => {
      const selected = index === grid.index;
      const distinct = !!grid.entries[index].bossesTile;
      card.bg.clear();
      card.bg.fillStyle(distinct ? 0x2a2410 : 0x151b15, selected ? 0.98 : 0.85);
      card.bg.fillRoundedRect(0, 0, CARD_W, CARD_H, 8);
      const border = selected ? 0xffd54f : distinct ? 0xffae42 : 0x446044;
      card.bg.lineStyle(selected ? 4 : distinct ? 3 : 2, border, 1);
      card.bg.strokeRoundedRect(0, 0, CARD_W, CARD_H, 8);
      card.container.setScale(selected ? 1.03 : 1);
      if (card.name) card.name.setColor(selected ? '#ffffff' : distinct ? '#ffd54f' : '#dddddd');
    });
  }

  setGridZones(grid, enabled) {
    for (const z of grid.zones) {
      if (enabled) z.setInteractive({ useHandCursor: true });
      else z.disableInteractive();
    }
  }

  activate(grid, index) {
    const entry = grid.entries[index];
    if (!entry) return;
    if (entry.bossesTile) this.openBossGallery();
    else this.openDetail(entry, this.mode);
  }

  openBossGallery() {
    playSfx(this, 'uiConfirm');
    this.bossGrid.index = 0;
    this.showBossGallery();
  }

  openDetail(entry, fromMode) {
    playSfx(this, 'uiConfirm');
    this.detailEntry = entry;
    this.detailReturn = fromMode === 'bossGallery' ? 'bossGallery' : 'gallery';
    this.mode = 'detail';

    this.setGridZones(this.mainGrid, false);
    this.setGridZones(this.bossGrid, false);
    this.gallery.setVisible(false);
    this.bossGallery.setVisible(false);
    this.detail.setVisible(true);

    const boss = isBossId(entry.id);
    this.subtitle.setText(boss ? 'boss details' : 'monster details');
    this.hint.setText(
      this.detailReturn === 'bossGallery' ? 'B / Esc back to bosses' : 'B / Esc back to monsters',
    );

    this.detailBg.clear();
    this.detailBg.fillStyle(0x151b15, 0.96);
    this.detailBg.fillRoundedRect(42, 94, 716, 410, 8);
    this.detailBg.lineStyle(3, 0x446044, 1);
    this.detailBg.strokeRoundedRect(42, 94, 716, 410, 8);
    this.detailBg.fillStyle(0x0b0f0b, 0.85);
    this.detailBg.fillRoundedRect(82, 132, 220, 220, 8);

    if (this.hasArt(entry)) {
      const def = ENEMY_SPRITES[entry.sprite];
      this.detailPortrait.setVisible(true);
      this.detailPortrait.setTexture(def.key, entry.frame);
      this.detailPortrait.setScale(entry.detailScale ?? 3.1);
      this.detailPortrait.clearTint();
      if (entry.tint) this.detailPortrait.setTint(entry.tint);
      this.detailNoArt.setVisible(false);
    } else {
      this.detailPortrait.setVisible(false);
      this.detailNoArt.setVisible(true);
    }

    this.detailName.setText(entry.name);
    this.detailWave.setText(`Appears: ${entry.firstWave}`);
    this.detailHp.setText(`Health: ${enemyMaxHp(entry.id)} HP`);
    this.detailMovement.setText(`Movement\n${entry.movement}`);
    this.detailPower.setText(`Special Power\n${entry.power}`);
    this.detailCounter.setText(`How to Fight\n${entry.counter}`);

    // Bosses cannot be demoed; everything else gets a working Demo button.
    this.demoBtnBg.clear();
    this.demoBtnLabel.setVisible(!boss);
    if (boss) {
      this.demoButton.disableInteractive();
    } else {
      this.demoBtnBg.fillStyle(0xffd54f, 1);
      this.demoBtnBg.fillRoundedRect(110, 384, 160, 40, 8);
      this.demoButton.setInteractive({ useHandCursor: true });
    }
  }

  showGallery() {
    this.mode = 'gallery';
    this.activeGrid = this.mainGrid;
    this.demoButton.disableInteractive();
    this.setGridZones(this.bossGrid, false);
    this.setGridZones(this.mainGrid, true);
    this.bossGallery.setVisible(false);
    this.detail.setVisible(false);
    this.gallery.setVisible(true);
    this.title.setText('MONSTERS');
    this.subtitle.setText('select a monster to inspect its power');
    this.hint.setText('arrows select  •  enter inspect  •  B / Esc back');
    this.refreshGrid(this.mainGrid);
  }

  showBossGallery() {
    this.mode = 'bossGallery';
    this.activeGrid = this.bossGrid;
    this.demoButton.disableInteractive();
    this.setGridZones(this.mainGrid, false);
    this.setGridZones(this.bossGrid, true);
    this.gallery.setVisible(false);
    this.detail.setVisible(false);
    this.bossGallery.setVisible(true);
    this.title.setText('BOSSES');
    this.subtitle.setText('select a boss to inspect its power');
    this.hint.setText('arrows select  •  enter inspect  •  B / Esc back');
    this.refreshGrid(this.bossGrid);
  }
}
