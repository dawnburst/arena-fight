import Phaser from 'phaser';
import { assetPath } from '../assetPath.js';
import { playSfx, preloadSfx } from '../audio.js';
import { MODS, TIER_COLORS, TIERS, WEAPONS } from '../catalog.js';
import { Save } from '../save.js';
import { skinsByPrice, skinThumb } from '../skins.js';
import { addTouchButton, isTouchMode } from './sceneUtils.js';

const ROW_HEIGHT = 30;
const HEADER_HEIGHT = 16;
const ICON_SIZE = 28;
const LIST_TOP = 92;
const STORE_ITEMS = [...WEAPONS, ...MODS];
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
    // Skin thumbnails: the shared base frame plus each shipped skin's own
    // south-idle frame (skinThumb resolves which applies per skin).
    for (const skin of [{ id: 'default', assetsReady: true }, ...skinsByPrice()]) {
      const { key, path } = skinThumb(skin);
      if (!this.textures.exists(key)) {
        this.load.image(key, assetPath(path));
      }
    }
    preloadSfx(this);
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
      .text(this.scale.width - 20, 22, '', { ...style, fontSize: '18px', color: '#ffd54f' })
      .setOrigin(1, 0);

    this.tabWeapons = this.add
      .text(20, 60, '[ WEAPONS ]', { ...style, fontSize: '16px' })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.setTab('weapons'));
    this.tabMods = this.add
      .text(180, 60, 'EQUIPMENT', { ...style, fontSize: '16px' })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.setTab('mods'));
    this.tabSkins = this.add
      .text(360, 60, 'SKINS', { ...style, fontSize: '16px' })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.setTab('skins'));

    this.listGroup = this.add.container(0, 0);

    // Large character preview shown only in the Skins tab (centered below the
    // 8-row list, which ends ~y=332; clears the bottom panel at y=522).
    const previewCx = Math.round(this.scale.width / 2);
    const previewCy = 400;
    this.skinPreviewBg = this.add
      .rectangle(previewCx, previewCy, 130, 130, 0x0a0a14, 1)
      .setStrokeStyle(2, 0x444444, 1)
      .setVisible(false);
    this.skinPreviewImg = this.add
      .image(previewCx, previewCy, itemIconKey(STORE_ITEMS[0].id))
      .setDisplaySize(120, 120)
      .setVisible(false);
    this.skinPreviewLabel = this.add
      .text(previewCx, previewCy + 68, '', {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '13px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

    this.previewFrame = this.add
      .rectangle(50, this.scale.height - 54, 54, 54, 0x101010, 1)
      .setStrokeStyle(2, 0x666666, 1);
    this.previewIcon = this.add
      .image(50, this.scale.height - 54, itemIconKey(STORE_ITEMS[0].id))
      .setDisplaySize(48, 48)
      .setVisible(false);
    this.descText = this.add.text(90, this.scale.height - 78, '', {
      ...style,
      fontSize: '14px',
      color: '#bbbbbb',
      wordWrap: { width: this.scale.width - 110 },
    });

    this.hintText = this.add.text(
      20,
      this.scale.height - 24,
      '↑/↓ select  •  enter to buy  •  tab/←→ switch  •  B back  •  R reset',
      { ...style, fontSize: '12px', color: '#666' },
    );

    this.confirmText = this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        'RESET SAVE — wipe wallet + items?\n  Y confirm  ·  N cancel',
        { ...style, fontSize: '20px', color: '#ff5252', align: 'center' },
      )
      .setOrigin(0.5)
      .setVisible(false);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.input.keyboard.on('keydown', this.onKey, this);

    // Stateless layout: rebuild on a mobile rotate / fullscreen toggle.
    this.onResize = () => this.scene.restart(this.scene.settings.data);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);

    this.createTouchControls();
    this.refresh();
  }

  // The list rows and the tab labels are directly tappable (see refresh() and
  // create()), so touch only needs an on-screen BACK button. Touch buys are
  // routed through a confirmation dialog (createBuyConfirm) so a stray tap can't
  // spend coins.
  createTouchControls() {
    if (!isTouchMode()) return;
    addTouchButton(this, {
      x: this.scale.width - 138,
      y: 56,
      width: 124,
      height: 46,
      label: '‹ BACK',
      onClick: () => this.back(),
    });
    this.createBuyConfirm();
  }

  createBuyConfirm() {
    const w = this.scale.width;
    const h = this.scale.height;
    const style = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', color: '#ffffff' };

    // Full-canvas blocker dims the screen and swallows taps on the list behind
    // the dialog (Phaser input is top-only, so the dialog buttons still win).
    const blocker = this.add
      .rectangle(0, 0, w, h, 0x000000, 0.6)
      .setOrigin(0)
      .setDepth(1390)
      .setInteractive()
      .on('pointerdown', () => this.hideBuyConfirm());
    const panel = this.add
      .rectangle(w / 2, h / 2, 460, 180, 0x101710, 0.98)
      .setStrokeStyle(2, 0x69f0ae)
      .setDepth(1400);
    const text = this.add
      .text(w / 2, h / 2 - 40, '', { ...style, fontSize: '18px', align: 'center' })
      .setOrigin(0.5)
      .setDepth(1450);
    const yes = addTouchButton(this, {
      x: w / 2 - 150,
      y: h / 2 + 12,
      width: 134,
      height: 48,
      label: 'BUY',
      color: 0xffd54f,
      onClick: () => this.confirmBuy(),
    });
    const no = addTouchButton(this, {
      x: w / 2 + 16,
      y: h / 2 + 12,
      width: 134,
      height: 48,
      label: 'CANCEL',
      onClick: () => this.hideBuyConfirm(),
    });

    this.buyConfirm = { blocker, panel, text, yes, no };
    this.pendingBuy = null;
    this.setBuyConfirmVisible(false);
  }

  setBuyConfirmVisible(visible) {
    if (!this.buyConfirm) return;
    const { blocker, panel, text, yes, no } = this.buyConfirm;
    blocker.setVisible(visible);
    if (visible) blocker.setInteractive();
    else blocker.disableInteractive();
    panel.setVisible(visible);
    text.setVisible(visible);
    yes.setVisible(visible);
    no.setVisible(visible);
  }

  showBuyConfirm(entry) {
    if (!this.buyConfirm) return;
    this.pendingBuy = entry;
    this.buyConfirm.text.setText(`Buy ${entry.name}\nfor ¢${entry.price}?`);
    this.setBuyConfirmVisible(true);
  }

  hideBuyConfirm() {
    this.pendingBuy = null;
    this.setBuyConfirmVisible(false);
  }

  confirmBuy() {
    if (!this.pendingBuy) return;
    this.tryBuy();
    this.hideBuyConfirm();
  }

  back() {
    playSfx(this, 'uiCancel');
    const data = this.scene.settings.data || {};
    this.scene.start(data.returnScene || 'MainMenuScene', data);
  }

  setTab(tab) {
    if (this.tab === tab) return;
    playSfx(this, 'uiMove');
    this.tab = tab;
    this.selectedIndex = 0;
    this.refresh();
  }

  switchTab(dir = 1) {
    const tabs = ['weapons', 'mods', 'skins'];
    const i = tabs.indexOf(this.tab);
    this.setTab(tabs[(i + dir + tabs.length) % tabs.length]);
  }

  moveSelection(dir) {
    const next = Phaser.Math.Clamp(this.selectedIndex + dir, 0, this.entries.length - 1);
    if (next !== this.selectedIndex) playSfx(this, 'uiMove');
    this.selectedIndex = next;
    this.refresh();
  }

  // Click/tap a row: select it (preview) and, when buy is true, attempt the
  // purchase. Deferred a tick because refresh() destroys and rebuilds the row
  // objects, including the one whose pointer event is firing.
  selectRow(index, buy) {
    if (this.pendingBuy) return; // a confirm dialog is open
    this.time.delayedCall(0, () => {
      const idx = Phaser.Math.Clamp(index, 0, this.entries.length - 1);
      const changed = idx !== this.selectedIndex;
      this.selectedIndex = idx;
      if (buy) {
        // On touch, confirm before spending coins; desktop clicks buy directly.
        const entry = this.entries[idx];
        const buyable = entry && !entry.owned && !entry.locked && Save.get().wallet >= entry.price;
        if (isTouchMode() && buyable) {
          this.refresh();
          this.showBuyConfirm(entry);
          return;
        }
        this.tryBuy();
        this.refresh();
      } else if (changed) {
        this.refresh();
      }
    });
  }

  shutdown() {
    this.input.keyboard.off('keydown', this.onKey, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
  }

  onKey(event) {
    if (this.pendingBuy) {
      if (event.key === 'y' || event.key === 'Y' || event.key === 'Enter') this.confirmBuy();
      else if (event.key === 'n' || event.key === 'N' || event.key === 'Escape')
        this.hideBuyConfirm();
      return;
    }
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
      this.back();
      return;
    }
    if (event.key === 'r' || event.key === 'R') {
      this.confirmReset = true;
      this.confirmText.setVisible(true);
      return;
    }
    if (event.key === 'Tab' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault?.();
      this.switchTab(event.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      this.moveSelection(-1);
      return;
    }
    if (event.key === 'ArrowDown') {
      this.moveSelection(1);
      return;
    }
    if (event.key === 'Enter') {
      this.tryBuy();
      return;
    }
  }

  tryBuy() {
    const entry = this.entries[this.selectedIndex];
    if (!entry) {
      playSfx(this, 'purchaseFail');
      return;
    }
    if (this.tab === 'skins') {
      this.trySkinAction(entry);
      return;
    }
    if (entry.owned || entry.locked) {
      playSfx(this, 'purchaseFail');
      return;
    }
    const save = Save.get();
    if (save.wallet < entry.price) {
      playSfx(this, 'purchaseFail');
      return;
    }
    if (this.tab === 'weapons') Save.buyWeapon(entry.id, entry.price);
    else Save.buyMod(entry.id, entry.price);
    playSfx(this, 'purchase');
    this.refresh();
  }

  // Skins: an owned-but-unequipped skin equips on click/tap; an unowned skin is
  // bought (and auto-equipped); the equipped skin does nothing.
  trySkinAction(entry) {
    if (entry.equipped) {
      playSfx(this, 'uiMove');
      return;
    }
    if (entry.owned) {
      Save.equipSkin(entry.id);
      playSfx(this, 'uiConfirm');
      this.refresh();
      return;
    }
    const save = Save.get();
    if (save.wallet < entry.price) {
      playSfx(this, 'purchaseFail');
      return;
    }
    Save.buySkin(entry.id, entry.price);
    Save.equipSkin(entry.id);
    playSfx(this, 'purchase');
    this.refresh();
  }

  refresh() {
    const save = Save.get();
    this.walletText.setText(`¢ ${save.wallet}`);
    this.tabWeapons.setText(this.tab === 'weapons' ? '[ WEAPONS ]' : '  WEAPONS  ');
    this.tabMods.setText(this.tab === 'mods' ? '[ EQUIPMENT ]' : '  EQUIPMENT  ');
    this.tabSkins.setText(this.tab === 'skins' ? '[ SKINS ]' : '  SKINS  ');

    this.entries = [];
    if (this.tab === 'skins') {
      // Skins are a flat list sorted cheapest → most expensive (no tier groups).
      const ownedSkins = new Set(save.ownedSkins || ['default']);
      const equippedId = save.loadout?.skin || 'default';
      for (const skin of skinsByPrice()) {
        const thumb = skinThumb(skin);
        this.entries.push({
          id: skin.id,
          name: skin.name,
          tier: skin.tier,
          price: skin.price,
          description: skin.description,
          owned: ownedSkins.has(skin.id),
          equipped: skin.id === equippedId,
          locked: false,
          tint: thumb.tint,
          iconKey: thumb.key,
        });
      }
    } else {
      const source = this.tab === 'weapons' ? WEAPONS : MODS;
      const ownedSet = new Set(this.tab === 'weapons' ? save.ownedWeapons : save.ownedMods);
      const legendaryUnlocked = (save.stats?.bestWave ?? 0) >= 25;
      for (const tier of TIERS) {
        const items = source.filter(
          (it) => it.tier === tier && (this.tab === 'weapons' || it.price > 0),
        );
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
    }
    if (this.selectedIndex >= this.entries.length)
      this.selectedIndex = Math.max(0, this.entries.length - 1);

    this.listGroup.removeAll(true);

    let y = LIST_TOP;
    let lastTier = null;
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      // Skins render as a flat price-sorted list — no tier-group headers.
      if (this.tab !== 'skins' && e.tier !== lastTier) {
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
      // Tap/click the row to select it; clicking buys it (hover previews on
      // desktop). Index is captured per row.
      rowBg
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.selectRow(i, false))
        .on('pointerdown', () => this.selectRow(i, true));
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
      // Placeholder skins recolour the shared thumbnail with the skin's tint.
      if (e.tint != null) icon.setTint(e.tint);
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
      if (this.tab === 'skins' && e.equipped) {
        badge = '[EQUIPPED]';
        badgeColor = '#4caf50';
      } else if (this.tab === 'skins' && e.owned) {
        badge = '[EQUIP]';
        badgeColor = '#29b6f6';
      } else if (e.owned) {
        badge = '[OWNED]';
        badgeColor = '#4caf50';
      } else if (e.locked) {
        badge = '[WAVE 25]';
        badgeColor = '#ab47bc';
      } else if (save.wallet < e.price) {
        badge = `[NEED ¢${e.price - save.wallet}]`;
        badgeColor = '#ef5350';
      } else {
        badge = '[BUY]';
        badgeColor = '#ffd54f';
      }
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
    if (cur?.locked) desc += '  — Locked: reach wave 25 to unlock legendary items.';
    this.descText.setText(desc);

    const isSkins = this.tab === 'skins';
    if (cur) {
      this.previewFrame.setVisible(!isSkins).setStrokeStyle(2, tierColorNumber(cur.tier), 1);
      this.previewIcon.setTexture(cur.iconKey).setVisible(!isSkins);
      if (cur.tint != null) this.previewIcon.setTint(cur.tint);
      else this.previewIcon.clearTint();
    } else {
      this.previewFrame.setVisible(false);
      this.previewIcon.setVisible(false);
    }

    // Large skin character preview — shows the selected skin's neutral south-idle
    // pose prominently below the list when the Skins tab is active.
    if (isSkins && cur) {
      this.skinPreviewBg.setVisible(true).setStrokeStyle(2, tierColorNumber(cur.tier), 1);
      this.skinPreviewImg.setTexture(cur.iconKey).setDisplaySize(120, 120).setVisible(true);
      if (cur.tint != null) this.skinPreviewImg.setTint(cur.tint);
      else this.skinPreviewImg.clearTint();
      this.skinPreviewLabel
        .setText(cur.name)
        .setStyle({ color: TIER_COLORS[cur.tier] || '#ffffff' })
        .setVisible(true);
    } else {
      this.skinPreviewBg.setVisible(false);
      this.skinPreviewImg.setVisible(false);
      this.skinPreviewLabel.setVisible(false);
    }
  }
}
