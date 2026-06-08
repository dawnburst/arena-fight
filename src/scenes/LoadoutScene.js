import Phaser from 'phaser';
import { CFG } from '../config.js';
import { Save } from '../save.js';
import { WEAPONS_BY_ID, MODS_BY_ID, TIER_COLORS } from '../catalog.js';

export default class LoadoutScene extends Phaser.Scene {
  constructor() {
    super('LoadoutScene');
  }

  create() {
    this.slotIndex = 0; // 0 = weapon, 1 = mod1, 2 = mod2

    const save = Save.get();
    this.weaponId = save.loadout.weapon || 'pistol';
    this.modIds = [save.loadout.mods?.[0] ?? null, save.loadout.mods?.[1] ?? null];

    const style = {
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      color: '#ffffff',
    };

    this.add.text(20, 16, 'LOADOUT', { ...style, fontSize: '28px' });
    this.add.text(20, 56, 'pick a weapon and up to 2 mods for your next run', {
      ...style, fontSize: '14px', color: '#aaaaaa',
    });

    this.slotTexts = [];
    this.slotValues = [];
    this.slotDescs = [];

    const labels = ['WEAPON', 'MOD 1', 'MOD 2'];
    for (let i = 0; i < 3; i++) {
      const y = 130 + i * 90;
      const label = this.add.text(40, y, labels[i], { ...style, fontSize: '16px', color: '#888' });
      const value = this.add.text(180, y, '', { ...style, fontSize: '24px' });
      const desc = this.add.text(180, y + 32, '', { ...style, fontSize: '13px', color: '#bbb', wordWrap: { width: 560 } });
      this.slotTexts.push(label);
      this.slotValues.push(value);
      this.slotDescs.push(desc);
    }

    this.hintText = this.add.text(
      20,
      CFG.arena.height - 60,
      '↑/↓ slot  •  ←/→ cycle  •  enter start run  •  B back',
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
      this.scene.start(data.returnScene || 'GameOverScene', data);
      return;
    }
    if (event.key === 'ArrowUp') {
      this.slotIndex = (this.slotIndex + 2) % 3;
      this.refresh();
      return;
    }
    if (event.key === 'ArrowDown') {
      this.slotIndex = (this.slotIndex + 1) % 3;
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
      Save.setLoadout(this.weaponId, this.modIds);
      this.scene.start('GameScene');
      return;
    }
  }

  cycle(dir) {
    const save = Save.get();
    if (this.slotIndex === 0) {
      const list = save.ownedWeapons.length ? save.ownedWeapons : ['pistol'];
      const idx = Math.max(0, list.indexOf(this.weaponId));
      this.weaponId = list[(idx + dir + list.length) % list.length];
    } else {
      const otherSlot = this.slotIndex === 1 ? 1 : 0;
      const taken = this.modIds[otherSlot];
      const avail = save.ownedMods.filter((m) => m !== taken);
      const choices = [null, ...avail];
      const slot = this.slotIndex - 1;
      const cur = this.modIds[slot];
      const idx = Math.max(0, choices.indexOf(cur));
      this.modIds[slot] = choices[(idx + dir + choices.length) % choices.length];
    }
    this.refresh();
  }

  refresh() {
    const labels = ['WEAPON', 'MOD 1', 'MOD 2'];
    for (let i = 0; i < 3; i++) {
      const selected = i === this.slotIndex;
      this.slotTexts[i].setText(`${selected ? '▶ ' : '  '}${labels[i]}`);
      this.slotTexts[i].setColor(selected ? '#ffd54f' : '#888');
    }

    const weapon = WEAPONS_BY_ID[this.weaponId];
    if (weapon) {
      this.slotValues[0].setText(`< ${weapon.name} >`);
      this.slotValues[0].setColor(TIER_COLORS[weapon.tier]);
      this.slotDescs[0].setText(weapon.description);
    } else {
      this.slotValues[0].setText('< Pistol >');
      this.slotDescs[0].setText('');
    }

    for (let i = 0; i < 2; i++) {
      const id = this.modIds[i];
      const mod = id ? MODS_BY_ID[id] : null;
      if (mod) {
        this.slotValues[i + 1].setText(`< ${mod.name} >`);
        this.slotValues[i + 1].setColor(TIER_COLORS[mod.tier]);
        this.slotDescs[i + 1].setText(mod.description);
      } else {
        this.slotValues[i + 1].setText('< (empty) >');
        this.slotValues[i + 1].setColor('#666');
        this.slotDescs[i + 1].setText('no mod equipped in this slot');
      }
    }
  }
}
