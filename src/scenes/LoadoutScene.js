import Phaser from 'phaser';
import { CFG } from '../config.js';
import { Save } from '../save.js';
import { WEAPONS_BY_ID, MODS_BY_ID, TIER_COLORS } from '../catalog.js';

const SLOT_LABELS = ['WEAPON 1', 'WEAPON 2', 'MOD 1', 'MOD 2'];

export default class LoadoutScene extends Phaser.Scene {
  constructor() {
    super('LoadoutScene');
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
    this.add.text(20, 56, 'pick up to 2 weapons and up to 2 mods for your next run', {
      ...style, fontSize: '14px', color: '#aaaaaa',
    });

    this.slotTexts = [];
    this.slotValues = [];
    this.slotDescs = [];

    for (let i = 0; i < SLOT_LABELS.length; i++) {
      const y = 120 + i * 84;
      const label = this.add.text(40, y, SLOT_LABELS[i], { ...style, fontSize: '16px', color: '#888' });
      const value = this.add.text(180, y, '', { ...style, fontSize: '24px' });
      const desc = this.add.text(180, y + 32, '', { ...style, fontSize: '13px', color: '#bbb', wordWrap: { width: 560 } });
      this.slotTexts.push(label);
      this.slotValues.push(value);
      this.slotDescs.push(desc);
    }

    this.hintText = this.add.text(
      20,
      CFG.arena.height - 36,
      '↑/↓ slot  •  ←/→ cycle  •  enter start run  •  B back  •  swap weapons in-game with C',
      { ...style, fontSize: '12px', color: '#666' },
    );

    this.input.keyboard.on('keydown', this.onKey, this);

    this.refresh();
  }

  shutdown() {
    this.input.keyboard.off('keydown', this.onKey, this);
  }

  onKey(event) {
    if (event.key === 'b' || event.key === 'B' || event.key === 'Escape') {
      const data = this.scene.settings.data || {};
      this.scene.start(data.returnScene || 'MainMenuScene', data);
      return;
    }
    if (event.key === 'ArrowUp') {
      this.slotIndex = (this.slotIndex + SLOT_LABELS.length - 1) % SLOT_LABELS.length;
      this.refresh();
      return;
    }
    if (event.key === 'ArrowDown') {
      this.slotIndex = (this.slotIndex + 1) % SLOT_LABELS.length;
      this.refresh();
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
      Save.setLoadout(this.weaponIds, this.modIds);
      this.scene.start('GameScene');
      return;
    }
  }

  cycle(dir) {
    const save = Save.get();
    if (this.slotIndex === 0 || this.slotIndex === 1) {
      const isPrimary = this.slotIndex === 0;
      const other = this.weaponIds[isPrimary ? 1 : 0];
      const avail = (save.ownedWeapons.length ? save.ownedWeapons : ['pistol']).filter((w) => w !== other);
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
        this.slotValues[i].setText(`< ${weapon.name} >`);
        this.slotValues[i].setColor(TIER_COLORS[weapon.tier]);
        this.slotDescs[i].setText(weapon.description);
      } else {
        this.slotValues[i].setText('< (empty) >');
        this.slotValues[i].setColor('#666');
        this.slotDescs[i].setText('no secondary weapon — equip one to swap with C in-game');
      }
    }

    for (let i = 0; i < 2; i++) {
      const id = this.modIds[i];
      const mod = id ? MODS_BY_ID[id] : null;
      if (mod) {
        this.slotValues[i + 2].setText(`< ${mod.name} >`);
        this.slotValues[i + 2].setColor(TIER_COLORS[mod.tier]);
        this.slotDescs[i + 2].setText(mod.description);
      } else {
        this.slotValues[i + 2].setText('< (empty) >');
        this.slotValues[i + 2].setColor('#666');
        this.slotDescs[i + 2].setText('no mod equipped in this slot');
      }
    }
  }
}
