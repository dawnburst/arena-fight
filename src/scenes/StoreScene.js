import Phaser from 'phaser';
import { assetPath } from '../assetPath.js';
import { CFG } from '../config.js';
import { Save } from '../save.js';
import { WEAPONS, MODS, TIER_COLORS, TIERS } from '../catalog.js';

const ROW_HEIGHT = 30;
const HEADER_HEIGHT = 16;
const ICON_SIZE = 28;
const LIST_TOP = 92;
const STORE_ITEMS = [...WEAPONS, ...MODS].filter((it) => it.price > 0);
const itemIconKey = (id) => `store-item-${id}`;
const tierColorNumber = (tier) => Phaser.Display.Color.HexStringToColor(TIER_COLORS[tier]).color;

export default class StoreScene extends Phaser.Scene {
  constructor() {
    super('StoreScene');
  }

  preload() {
    for (const item of STORE_ITEMS) {
      const key = itemIconKey(item.id);
      if (!this.textures.exists(key)) {
        this.load.image(key, assetPath(`assets/items/${item.id}.png`));
      }
    }
  }

  create() {
    this.tab = 'weapons';
    this.selectedIndex = 0;
    this.confirmReset = false;

    const style = {
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      color: '#ffffff',
    };

    this.add.text(20, 16, 'STORE', { ...style, fontSize: '28px' });
    this.walletText = this.add
      .text(CFG.arena.width - 20, 22, '', { ...style, fontSize: '18px', color: '#ffd54f' })
      .setOrigin(1, 0);

    this.tabWeapons = this.add.text(20, 60, '[ WEAPONS ]', { ...style, fontSize: '16px' });
    this.tabMods = this.add.text(180, 60, 'EQUIPMENT', { ...style, fontSize: '16px' });

    this.listGroup = this.add.container(0, 0);

    this.previewFrame = this.add
      .rectangle(50, CFG.arena.height - 54, 54, 54, 0x101010, 1)
      .setStrokeStyle(2, 0x666666, 1);
    this.previewIcon = this.add
      .image(50, CFG.arena.height - 54, itemIconKey(STORE_ITEMS[0].id))
      .setDisplaySize(48, 48)
      .setVisible(false);
    this.descText = this.add
      .text(90, CFG.arena.height - 78, '', {
        ...style,
        fontSize: '14px',
        color: '#bbbbbb',
        wordWrap: { width: CFG.arena.width - 110 },
      });

    this.hintText = this.add.text(
      20,
      CFG.arena.height - 24,
      '↑/↓ select  •  enter to buy  •  tab/←→ switch  •  B back  •  R reset',
      { ...style, fontSize: '12px', color: '#666' },
    );

    this.confirmText = this.add
      .text(CFG.arena.width / 2, CFG.arena.height / 2,
        'RESET SAVE — wipe wallet + items?\n  Y confirm  ·  N cancel',
        { ...style, fontSize: '20px', color: '#ff5252', align: 'center' })
      .setOrigin(0.5)
      .setVisible(false);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.input.keyboard.on('keydown', this.onKey, this);

    this.refresh();
  }

  shutdown() {
    this.input.keyboard.off('keydown', this.onKey, this);
  }

  onKey(event) {
    if (this.confirmReset) {
      if (event.key === 'y' || event.key === 'Y') {
        Save.reset();
        this.confirmReset = false;
        this.confirmText.setVisible(false);
        this.refresh();
      } else if (event.key === 'n' || event.key === 'N' || event.key === 'Escape') {
        this.confirmReset = false;
        this.confirmText.setVisible(false);
      }
      return;
    }
    if (event.key === 'b' || event.key === 'B' || event.key === 'Escape') {
      const data = this.scene.settings.data || {};
      this.scene.start(data.returnScene || 'MainMenuScene', data);
      return;
    }
    if (event.key === 'r' || event.key === 'R') {
      this.confirmReset = true;
      this.confirmText.setVisible(true);
      return;
    }
    if (event.key === 'Tab' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault?.();
      this.tab = this.tab === 'weapons' ? 'mods' : 'weapons';
      this.selectedIndex = 0;
      this.refresh();
      return;
    }
    if (event.key === 'ArrowUp') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.refresh();
      return;
    }
    if (event.key === 'ArrowDown') {
      this.selectedIndex = Math.min(this.entries.length - 1, this.selectedIndex + 1);
      this.refresh();
      return;
    }
    if (event.key === 'Enter') {
      this.tryBuy();
      return;
    }
  }

  tryBuy() {
    const entry = this.entries[this.selectedIndex];
    if (!entry || entry.owned || entry.locked) return;
    const save = Save.get();
    if (save.wallet < entry.price) return;
    if (this.tab === 'weapons') Save.buyWeapon(entry.id, entry.price);
    else Save.buyMod(entry.id, entry.price);
    this.refresh();
  }

  refresh() {
    const save = Save.get();
    this.walletText.setText(`¢ ${save.wallet}`);
    this.tabWeapons.setText(this.tab === 'weapons' ? '[ WEAPONS ]' : '  WEAPONS  ');
    this.tabMods.setText(this.tab === 'mods' ? '[ EQUIPMENT ]' : '  EQUIPMENT  ');

    const source = this.tab === 'weapons' ? WEAPONS : MODS;
    const ownedSet = new Set(this.tab === 'weapons' ? save.ownedWeapons : save.ownedMods);
    const legendaryUnlocked = (save.stats?.bestWave ?? 0) >= 25;

    this.entries = [];
    for (const tier of TIERS) {
      const items = source.filter((it) => it.tier === tier && it.price > 0);
      for (const it of items) {
        this.entries.push({
          id: it.id,
          name: it.name,
          tier: it.tier,
          price: it.price,
          description: it.description,
          owned: ownedSet.has(it.id),
          locked: it.tier === 'legendary' && !legendaryUnlocked,
          iconKey: itemIconKey(it.id),
        });
      }
    }
    if (this.selectedIndex >= this.entries.length) this.selectedIndex = Math.max(0, this.entries.length - 1);

    this.listGroup.removeAll(true);

    let y = LIST_TOP;
    let lastTier = null;
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      if (e.tier !== lastTier) {
        const header = this.add.text(20, y, e.tier.toUpperCase(), {
          fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
          fontSize: '14px',
          color: TIER_COLORS[e.tier],
        });
        this.listGroup.add(header);
        y += HEADER_HEIGHT;
        lastTier = e.tier;
      }

      const isSelected = i === this.selectedIndex;
      const rowBg = this.add
        .rectangle(30, y - 1, 720, ROW_HEIGHT, 0xffffff, isSelected ? 0.07 : 0)
        .setOrigin(0, 0);
      if (isSelected) rowBg.setStrokeStyle(1, 0xffffff, 0.16);
      this.listGroup.add(rowBg);

      const marker = this.add.text(38, y + 7, isSelected ? '▶' : '', {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '14px',
        color: '#ffd54f',
      });
      this.listGroup.add(marker);

      const icon = this.add
        .image(64, y + ROW_HEIGHT / 2, e.iconKey)
        .setDisplaySize(ICON_SIZE, ICON_SIZE);
      this.listGroup.add(icon);

      const nameLine = this.add.text(92, y + 7, e.name, {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '14px',
        color: isSelected ? '#ffffff' : '#dddddd',
      });
      this.listGroup.add(nameLine);

      const priceText = this.add.text(410, y + 7, `¢ ${e.price}`, {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '14px',
        color: '#ffd54f',
      });
      this.listGroup.add(priceText);

      let badge;
      let badgeColor = '#888';
      if (e.owned) { badge = '[OWNED]'; badgeColor = '#4caf50'; }
      else if (e.locked) { badge = '[WAVE 25]'; badgeColor = '#ab47bc'; }
      else if (save.wallet < e.price) { badge = `[NEED ¢${e.price - save.wallet}]`; badgeColor = '#ef5350'; }
      else { badge = '[BUY]'; badgeColor = '#ffd54f'; }
      const badgeText = this.add.text(520, y + 7, badge, {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '14px',
        color: badgeColor,
      });
      this.listGroup.add(badgeText);

      y += ROW_HEIGHT;
    }

    const cur = this.entries[this.selectedIndex];
    let desc = cur ? cur.description : '';
    if (cur && cur.locked) desc += '  — Locked: reach wave 25 to unlock legendary items.';
    this.descText.setText(desc);
    if (cur) {
      this.previewFrame.setVisible(true).setStrokeStyle(2, tierColorNumber(cur.tier), 1);
      this.previewIcon.setTexture(cur.iconKey).setVisible(true);
    } else {
      this.previewFrame.setVisible(false);
      this.previewIcon.setVisible(false);
    }
  }
}
