import Phaser from 'phaser';
import { assetPath } from '../assetPath.js';
import { playSfx, preloadSfx } from '../audio.js';
import { MODS, MODS_BY_ID, TIER_COLORS, WEAPONS, WEAPONS_BY_ID } from '../catalog.js';
import { Save } from '../save.js';
import { addTouchButton, isTouchMode } from './sceneUtils.js';

const SLOT_LABELS = ['WEAPON 1', 'WEAPON 2', 'EQUIPMENT 1', 'EQUIPMENT 2'];
// Desktop draws the value at x=255; touch shifts it right to make room for the ◀.
const DESKTOP_VALUE_X = 255;
const TOUCH_VALUE_X = 296;
// On touch the description drops below the value so the tall ◀/▶ tap targets
// (aligned to the value line) never cover it (desktop keeps the default +32).
const TOUCH_DESC_DY = 46;
// Shares the StoreScene icon key scheme so textures are reused once loaded.
const itemIconKey = (id) => `store-item-${id}`;

export default class LoadoutScene extends Phaser.Scene {
  constructor() {
    super('LoadoutScene');
  }

  preload() {
    for (const item of [...WEAPONS, ...MODS]) {
      const key = itemIconKey(item.id);
      if (!this.textures.exists(key)) {
        this.load.image(key, assetPath(`assets/items/${item.id}.png`));
      }
    }
    preloadSfx(this);
  }

  create() {
    this.slotIndex = 0; // 0 = weapon1, 1 = weapon2, 2 = mod1, 3 = mod2

    const save = Save.get();
    this.weaponIds = [
      save.loadout.weapons?.[0] || save.loadout.weapon || 'pistol',
      save.loadout.weapons?.[1] ?? null,
    ];
    this.modIds = [save.loadout.mods?.[0] ?? null, save.loadout.mods?.[1] ?? null];

    const style = {
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      color: '#ffffff',
    };

    this.add.text(20, 16, 'LOADOUT', { ...style, fontSize: '28px' });
    this.add.text(20, 56, 'pick up to 2 weapons and up to 2 equipment for your next run', {
      ...style,
      fontSize: '14px',
      color: '#aaaaaa',
    });

    this.slotTexts = [];
    this.slotIcons = [];
    this.slotValues = [];
    this.slotDescs = [];

    for (let i = 0; i < SLOT_LABELS.length; i++) {
      const y = 120 + i * 84;
      const label = this.add.text(40, y, SLOT_LABELS[i], {
        ...style,
        fontSize: '16px',
        color: '#888',
      });
      const frame = this.add
        .rectangle(200, y + 14, 50, 50, 0x101010, 1)
        .setStrokeStyle(2, 0x444444, 1);
      const icon = this.add
        .image(200, y + 14, '__DEFAULT')
        .setDisplaySize(44, 44)
        .setVisible(false);
      const value = this.add.text(DESKTOP_VALUE_X, y, '', { ...style, fontSize: '24px' });
      const desc = this.add.text(DESKTOP_VALUE_X, y + 32, '', {
        ...style,
        fontSize: '13px',
        color: '#bbb',
        wordWrap: { width: 510 },
      });
      this.slotTexts.push(label);
      this.slotIcons.push({ frame, icon });
      this.slotValues.push(value);
      this.slotDescs.push(desc);
    }

    this.hintText = this.add.text(
      20,
      this.scale.height - 36,
      '↑/↓ slot  •  ←/→ cycle  •  enter start run  •  B back  •  swap weapons in-game with C',
      { ...style, fontSize: '12px', color: '#666' },
    );

    this.input.keyboard.on('keydown', this.onKey, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    // Stateless layout: rebuild on a mobile rotate / fullscreen toggle.
    this.onResize = () => this.scene.restart(this.scene.settings.data);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);

    this.createTouchControls();
    this.refresh();
  }

  // Touch: each slot is directly tappable to select it, with inline ◀/▶ arrows to
  // cycle its weapon/equipment choice both ways. Only BACK and START need stacked
  // buttons. Desktop keeps the keyboard flow untouched.
  createTouchControls() {
    if (!isTouchMode()) return;
    const bw = 124;
    const bh = 46;
    const x = this.scale.width - bw - 14;
    addTouchButton(this, {
      x,
      y: 18,
      width: bw,
      height: bh,
      label: '‹ BACK',
      onClick: () => this.back(),
    });
    addTouchButton(this, {
      x,
      y: this.scale.height - bh - 18,
      width: bw,
      height: bh,
      label: 'START',
      color: 0xffd54f,
      onClick: () => this.startRun(),
    });

    // Shift the value right to make room for the ◀ arrow and flank the value with
    // arrows ("◀ Name ▶"). The arrows align to the value line; the description is
    // pushed down so the tall tap targets never cover it. ▶ is repositioned in
    // refresh() to sit right after the (variable-width) value.
    this.slotArrows = [];
    for (let i = 0; i < SLOT_LABELS.length; i++) {
      const y = 120 + i * 84;
      this.slotValues[i].setX(TOUCH_VALUE_X);
      this.slotDescs[i].setX(TOUCH_VALUE_X).setY(y + TOUCH_DESC_DY);
      // Tap the left part of the row (label/icon/value) to select it.
      this.add
        .zone(36, y - 6, 680, 74)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectSlot(i));
      const left = addTouchButton(this, {
        x: TOUCH_VALUE_X - 48,
        y: y - 4,
        width: 38,
        height: 38,
        label: '◀',
        fontSize: '16px',
        onClick: () => this.cycleSlot(i, -1),
      });
      const right = addTouchButton(this, {
        x: TOUCH_VALUE_X,
        y: y - 4,
        width: 38,
        height: 38,
        label: '▶',
        fontSize: '16px',
        onClick: () => this.cycleSlot(i, 1),
      });
      this.slotArrows.push({ left, right });
    }
  }

  // Keeps each ▶ arrow tucked right after its value text (called from refresh()).
  layoutSlotArrows() {
    if (!this.slotArrows) return;
    for (let i = 0; i < this.slotArrows.length; i++) {
      const y = 120 + i * 84;
      const value = this.slotValues[i];
      this.slotArrows[i].right.setPosition(value.x + value.width + 12, y - 4);
    }
  }

  selectSlot(i) {
    if (i !== this.slotIndex) playSfx(this, 'uiMove');
    this.slotIndex = i;
    this.refresh();
  }

  // Select the tapped slot, then cycle its choice (the inline ◀/▶ arrows).
  cycleSlot(i, dir) {
    this.slotIndex = i;
    this.cycle(dir);
  }

  back() {
    playSfx(this, 'uiCancel');
    const data = this.scene.settings.data || {};
    this.scene.start(data.returnScene || 'MainMenuScene', data);
  }

  moveSlot(dir) {
    playSfx(this, 'uiMove');
    this.slotIndex = (this.slotIndex + dir + SLOT_LABELS.length) % SLOT_LABELS.length;
    this.refresh();
  }

  startRun() {
    playSfx(this, 'uiConfirm');
    Save.setLoadout(this.weaponIds, this.modIds);
    this.scene.start('GameScene', { tutorial: false });
  }

  shutdown() {
    this.input.keyboard.off('keydown', this.onKey, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
  }

  onKey(event) {
    if (event.key === 'b' || event.key === 'B' || event.key === 'Escape') {
      this.back();
      return;
    }
    if (event.key === 'ArrowUp') {
      this.moveSlot(-1);
      return;
    }
    if (event.key === 'ArrowDown') {
      this.moveSlot(1);
      return;
    }
    if (event.key === 'ArrowLeft') {
      this.cycle(-1);
      return;
    }
    if (event.key === 'ArrowRight') {
      this.cycle(1);
      return;
    }
    if (event.key === 'Enter') {
      this.startRun();
      return;
    }
  }

  cycle(dir) {
    playSfx(this, 'uiMove');
    const save = Save.get();
    if (this.slotIndex === 0 || this.slotIndex === 1) {
      const isPrimary = this.slotIndex === 0;
      const other = this.weaponIds[isPrimary ? 1 : 0];
      const avail = (save.ownedWeapons.length ? save.ownedWeapons : ['pistol']).filter(
        (w) => w !== other,
      );
      // The primary weapon is required; the secondary slot may be empty.
      const choices = isPrimary ? avail : [null, ...avail];
      if (!choices.length) return;
      const cur = this.weaponIds[this.slotIndex];
      const idx = Math.max(0, choices.indexOf(cur));
      this.weaponIds[this.slotIndex] = choices[(idx + dir + choices.length) % choices.length];
    } else {
      const slot = this.slotIndex - 2;
      const taken = this.modIds[1 - slot];
      const avail = save.ownedMods.filter((m) => m !== taken);
      const choices = [null, ...avail];
      const cur = this.modIds[slot];
      const idx = Math.max(0, choices.indexOf(cur));
      this.modIds[slot] = choices[(idx + dir + choices.length) % choices.length];
    }
    this.refresh();
  }

  setSlotIcon(i, id, tier) {
    const { frame, icon } = this.slotIcons[i];
    const key = id ? itemIconKey(id) : null;
    if (key && this.textures.exists(key)) {
      icon.setTexture(key).setDisplaySize(44, 44).setVisible(true);
      frame.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(TIER_COLORS[tier]).color, 1);
    } else {
      icon.setVisible(false);
      frame.setStrokeStyle(2, 0x444444, 1);
    }
  }

  refresh() {
    for (let i = 0; i < SLOT_LABELS.length; i++) {
      const selected = i === this.slotIndex;
      this.slotTexts[i].setText(`${selected ? '▶ ' : '  '}${SLOT_LABELS[i]}`);
      this.slotTexts[i].setColor(selected ? '#ffd54f' : '#888');
    }

    for (let i = 0; i < 2; i++) {
      const id = this.weaponIds[i];
      const weapon = id ? WEAPONS_BY_ID[id] : null;
      if (weapon) {
        this.slotValues[i].setText(this.valueText(weapon.name));
        this.slotValues[i].setColor(TIER_COLORS[weapon.tier]);
        this.slotDescs[i].setText(weapon.description);
      } else {
        this.slotValues[i].setText(this.valueText('(empty)'));
        this.slotValues[i].setColor('#666');
        this.slotDescs[i].setText('no secondary weapon — equip one to swap with C in-game');
      }
      this.setSlotIcon(i, id, weapon?.tier);
    }

    for (let i = 0; i < 2; i++) {
      const id = this.modIds[i];
      const mod = id ? MODS_BY_ID[id] : null;
      if (mod) {
        this.slotValues[i + 2].setText(this.valueText(mod.name));
        this.slotValues[i + 2].setColor(TIER_COLORS[mod.tier]);
        this.slotDescs[i + 2].setText(mod.description);
      } else {
        this.slotValues[i + 2].setText(this.valueText('(empty)'));
        this.slotValues[i + 2].setColor('#666');
        this.slotDescs[i + 2].setText('no equipment in this slot');
      }
      this.setSlotIcon(i + 2, id, mod?.tier);
    }

    this.layoutSlotArrows();
  }

  // On desktop the < > brackets hint that ←/→ cycle the value; on touch the inline
  // ◀/▶ arrows do that, so the brackets are dropped to keep the row clean.
  valueText(name) {
    return isTouchMode() ? name : `< ${name} >`;
  }
}
