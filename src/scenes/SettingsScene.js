import Phaser from 'phaser';
import { preloadMusic, syncMusic } from '../audio.js';
import {
  ARENA_BACKGROUNDS,
  backgroundKey,
  backgroundPath,
  resolveBackground,
} from '../backgrounds.js';
import { Save } from '../save.js';
import { toggleFullscreen } from '../viewport.js';
import { addTouchButton, coverBackground, isTouchMode } from './sceneUtils.js';

export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
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
    const current = resolveBackground(Save.get().settings?.backgroundId);
    this.selectedIndex = Math.max(
      0,
      ARENA_BACKGROUNDS.findIndex((bg) => bg.id === current.id),
    );

    coverBackground(this, backgroundKey(current.id)).setDepth(-20);
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.48).setOrigin(0);

    this.add.text(26, 18, 'SETTINGS', { ...style, fontSize: '30px', color: '#ffffff' });
    this.add.text(28, 58, 'choose arena background', {
      ...style,
      fontSize: '14px',
      color: '#bbbbbb',
    });

    this.views = [];
    const cardWidth = 230;
    const cardHeight = 255;
    const startX = 36;
    const y = 118;
    const gap = 18;

    ARENA_BACKGROUNDS.forEach((background, index) => {
      const x = startX + index * (cardWidth + gap);
      const container = this.add.container(x, y);
      const frame = this.add.graphics();
      const image = this.add
        .image(cardWidth / 2, 72, backgroundKey(background.id))
        .setDisplaySize(196, 147);
      const title = this.add.text(18, 166, background.name, {
        ...style,
        fontSize: '19px',
      });
      const desc = this.add.text(18, 198, background.description, {
        ...style,
        fontSize: '12px',
        color: '#cfcfcf',
        wordWrap: { width: cardWidth - 36 },
      });
      const marker = this.add
        .text(cardWidth - 18, 18, '', {
          ...style,
          fontSize: '18px',
          color: '#69f0ae',
        })
        .setOrigin(1, 0);

      container.add([frame, image, title, desc, marker]);
      container
        .setSize(cardWidth, cardHeight)
        .setInteractive(
          new Phaser.Geom.Rectangle(0, 0, cardWidth, cardHeight),
          Phaser.Geom.Rectangle.Contains,
        )
        .on('pointerover', () => {
          this.input.setDefaultCursor('pointer');
          this.select(index);
        })
        .on('pointerout', () => this.input.setDefaultCursor('default'))
        .on('pointerdown', () => this.applySelection(index));

      this.views.push({ container, frame, title, desc, marker });
    });

    this.createMusicControls(style);
    this.createTouchControlsRow(style);
    this.createFullscreenRow(style);

    this.hintText = this.add
      .text(
        this.scale.width / 2,
        this.scale.height - 26,
        '←/→ select  •  enter apply  •  M music  •  S sound  •  T touch  •  F fullscreen  •  B / Esc back',
        { ...style, fontSize: '13px', color: '#cccccc' },
      )
      .setOrigin(0.5);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.input.keyboard.on('keydown', this.onKey, this);

    // Stateless settings: rebuild on a mobile rotate / fullscreen toggle.
    this.onResize = () => this.scene.restart();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);

    if (isTouchMode()) {
      addTouchButton(this, {
        x: this.scale.width - 138,
        y: 18,
        width: 124,
        height: 46,
        label: '‹ BACK',
        onClick: () => this.scene.start('MainMenuScene'),
      });
    }

    this.refresh();
  }

  shutdown() {
    this.input.setDefaultCursor('default');
    this.input.keyboard.off('keydown', this.onKey, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
  }

  onKey(event) {
    if (event.key === 'b' || event.key === 'B' || event.key === 'Escape') {
      this.scene.start('MainMenuScene');
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault?.();
      this.select(this.selectedIndex - 1);
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault?.();
      this.select(this.selectedIndex + 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ' || event.code === 'Space') {
      event.preventDefault?.();
      this.applySelection(this.selectedIndex);
      return;
    }
    if (event.key === 'm' || event.key === 'M') {
      event.preventDefault?.();
      this.toggleMusic();
      return;
    }
    if (event.key === 's' || event.key === 'S') {
      event.preventDefault?.();
      this.toggleSfx();
      return;
    }
    if (event.key === 't' || event.key === 'T') {
      event.preventDefault?.();
      this.cycleTouchControls();
      return;
    }
    if (event.key === 'f' || event.key === 'F') {
      event.preventDefault?.();
      this.toggleFullscreenSetting();
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault?.();
      this.setMusicVolume((Save.get().settings?.musicVolume ?? 0.55) + 0.05);
      return;
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault?.();
      this.setMusicVolume((Save.get().settings?.musicVolume ?? 0.55) - 0.05);
    }
  }

  select(index) {
    this.selectedIndex = Phaser.Math.Wrap(index, 0, ARENA_BACKGROUNDS.length);
    this.refresh();
  }

  applySelection(index) {
    this.selectedIndex = Phaser.Math.Wrap(index, 0, ARENA_BACKGROUNDS.length);
    Save.setBackground(ARENA_BACKGROUNDS[this.selectedIndex].id);
    this.refresh();
  }

  createMusicControls(style) {
    const x = 36;
    const y = 392;
    const width = 724;
    const height = 132;
    const checkX = x + 124;
    const titleY = y + 18;
    const checkY = titleY - 1;
    const _musicRowY = y + 50;
    const sfxTitleY = y + 72;
    const sfxCheckY = sfxTitleY - 1;
    const _sfxRowY = y + 104;
    const sliderX = x + 356;
    const sliderWidth = 220;

    this.audioFrame = this.add.graphics();
    this.musicCheck = this.add.graphics();
    this.musicSlider = this.add.graphics();
    this.sfxCheck = this.add.graphics();
    this.sfxSlider = this.add.graphics();
    this.musicTitle = this.add.text(x + 24, titleY, 'MUSIC', {
      ...style,
      fontSize: '20px',
      color: '#ffd54f',
    });
    this.musicVolumeText = this.add
      .text(sliderX - 18, checkY + 5, '', {
        ...style,
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(1, 0);
    this.sfxTitle = this.add.text(x + 24, sfxTitleY, 'SOUND', {
      ...style,
      fontSize: '20px',
      color: '#ffd54f',
    });
    this.sfxVolumeText = this.add
      .text(sliderX - 18, sfxCheckY + 5, '', {
        ...style,
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(1, 0);

    this.musicToggleZone = this.add
      .zone(x + 24, titleY - 4, 150, 34)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggleMusic());

    this.musicCheckBounds = new Phaser.Geom.Rectangle(checkX, checkY, 28, 28);
    this.musicSliderBounds = new Phaser.Geom.Rectangle(sliderX, checkY + 2, sliderWidth, 24);
    this.musicSliderZone = this.add
      .zone(
        this.musicSliderBounds.x,
        this.musicSliderBounds.y - 8,
        this.musicSliderBounds.width,
        this.musicSliderBounds.height + 16,
      )
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer) => this.setMusicVolumeFromPointer(pointer))
      .on('pointermove', (pointer) => {
        if (pointer.isDown) this.setMusicVolumeFromPointer(pointer);
      });

    this.sfxToggleZone = this.add
      .zone(x + 24, sfxTitleY - 4, 150, 34)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggleSfx());

    this.sfxCheckBounds = new Phaser.Geom.Rectangle(checkX, sfxCheckY, 28, 28);
    this.sfxSliderBounds = new Phaser.Geom.Rectangle(sliderX, sfxCheckY + 2, sliderWidth, 24);
    this.sfxSliderZone = this.add
      .zone(
        this.sfxSliderBounds.x,
        this.sfxSliderBounds.y - 8,
        this.sfxSliderBounds.width,
        this.sfxSliderBounds.height + 16,
      )
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer) => this.setSfxVolumeFromPointer(pointer))
      .on('pointermove', (pointer) => {
        if (pointer.isDown) this.setSfxVolumeFromPointer(pointer);
      });

    this.audioFrame.fillStyle(0x121812, 0.9);
    this.audioFrame.fillRoundedRect(x, y, width, height, 8);
    this.audioFrame.lineStyle(2, 0x4f704f, 1);
    this.audioFrame.strokeRoundedRect(x, y, width, height, 8);
  }

  createTouchControlsRow(style) {
    const y = 534;
    this.add.text(60, y, 'TOUCH', { ...style, fontSize: '20px', color: '#ffd54f' });
    this.touchValueText = this.add.text(170, y + 3, '', { ...style, fontSize: '16px' });
    this.add.text(300, y + 5, '(applies on reload)', {
      ...style,
      fontSize: '12px',
      color: '#9e9e9e',
    });
    this.add
      .zone(56, y - 4, 380, 30)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.cycleTouchControls());
  }

  cycleTouchControls() {
    const order = ['auto', 'on', 'off'];
    const current = Save.get().settings?.touchControls ?? 'auto';
    const next = order[(order.indexOf(current) + 1) % order.length];
    Save.setTouchControls(next);
    this.refresh();
  }

  createFullscreenRow(style) {
    const y = 534;
    const x = 520;
    this.add.text(x, y, 'FULLSCREEN', { ...style, fontSize: '20px', color: '#ffd54f' });
    this.fullscreenValueText = this.add.text(x + 168, y + 3, '', { ...style, fontSize: '16px' });
    this.add
      .zone(x - 4, y - 4, 260, 30)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggleFullscreenSetting());
  }

  // Persist the preference and apply it immediately — toggling here is itself a
  // user gesture, so the browser allows entering/leaving fullscreen now.
  toggleFullscreenSetting() {
    const enabled = Save.get().settings?.fullscreen !== false;
    Save.setFullscreen(!enabled);
    toggleFullscreen(this);
    this.refresh();
  }

  toggleMusic() {
    const enabled = Save.get().settings?.musicEnabled !== false;
    Save.setMusicEnabled(!enabled);
    syncMusic(this);
    this.refresh();
  }

  setMusicVolume(volume) {
    Save.setMusicVolume(Phaser.Math.Clamp(volume, 0, 1));
    syncMusic(this);
    this.refresh();
  }

  setMusicVolumeFromPointer(pointer) {
    const bounds = this.musicSliderBounds;
    const volume = Phaser.Math.Clamp((pointer.x - bounds.x) / bounds.width, 0, 1);
    this.setMusicVolume(volume);
  }

  toggleSfx() {
    const enabled = Save.get().settings?.sfxEnabled !== false;
    Save.setSfxEnabled(!enabled);
    this.refresh();
  }

  setSfxVolume(volume) {
    Save.setSfxVolume(Phaser.Math.Clamp(volume, 0, 1));
    this.refresh();
  }

  setSfxVolumeFromPointer(pointer) {
    const bounds = this.sfxSliderBounds;
    const volume = Phaser.Math.Clamp((pointer.x - bounds.x) / bounds.width, 0, 1);
    this.setSfxVolume(volume);
  }

  refresh() {
    const current = resolveBackground(Save.get().settings?.backgroundId);
    this.views.forEach((view, index) => {
      const background = ARENA_BACKGROUNDS[index];
      const selected = index === this.selectedIndex;
      const active = background.id === current.id;
      const borderColor = active ? 0x69f0ae : selected ? 0xffd54f : 0x444444;

      view.frame.clear();
      view.frame.fillStyle(0x121812, selected ? 0.98 : 0.88);
      view.frame.fillRoundedRect(0, 0, 230, 255, 8);
      view.frame.lineStyle(selected ? 4 : 2, borderColor, 1);
      view.frame.strokeRoundedRect(0, 0, 230, 255, 8);
      view.title.setColor(active ? '#69f0ae' : selected ? '#ffd54f' : '#ffffff');
      view.desc.setColor(selected ? '#ffffff' : '#bfbfbf');
      view.marker.setText(active ? 'ON' : '');
      view.container.setScale(selected ? 1.02 : 1);
    });

    this.refreshMusicControls();
    this.refreshSfxControls();

    if (this.touchValueText) {
      const mode = Save.get().settings?.touchControls ?? 'auto';
      this.touchValueText.setText(mode.toUpperCase());
    }

    if (this.fullscreenValueText) {
      const on = Save.get().settings?.fullscreen !== false;
      this.fullscreenValueText.setText(on ? 'ON' : 'OFF');
    }
  }

  refreshMusicControls() {
    if (!this.musicCheck) return;
    const settings = Save.get().settings || {};
    const enabled = settings.musicEnabled !== false;
    const volume = Phaser.Math.Clamp(settings.musicVolume ?? 0.55, 0, 1);

    this.musicVolumeText.setText(`Volume ${Math.round(volume * 100)}%`);
    this.drawAudioControl(
      this.musicCheck,
      this.musicSlider,
      this.musicCheckBounds,
      this.musicSliderBounds,
      enabled,
      volume,
    );
  }

  refreshSfxControls() {
    if (!this.sfxCheck) return;
    const settings = Save.get().settings || {};
    const enabled = settings.sfxEnabled !== false;
    const volume = Phaser.Math.Clamp(settings.sfxVolume ?? 0.75, 0, 1);

    this.sfxVolumeText.setText(`Volume ${Math.round(volume * 100)}%`);
    this.drawAudioControl(
      this.sfxCheck,
      this.sfxSlider,
      this.sfxCheckBounds,
      this.sfxSliderBounds,
      enabled,
      volume,
    );
  }

  drawAudioControl(check, slider, checkBounds, sliderBounds, enabled, volume) {
    const knobX = sliderBounds.x + sliderBounds.width * volume;

    check.clear();
    check.fillStyle(enabled ? 0x1b3d28 : 0x241818, 1);
    check.fillRoundedRect(checkBounds.x, checkBounds.y, checkBounds.width, checkBounds.height, 5);
    check.lineStyle(3, enabled ? 0x69f0ae : 0xff8a80, 1);
    check.strokeRoundedRect(checkBounds.x, checkBounds.y, checkBounds.width, checkBounds.height, 5);
    if (enabled) {
      check.lineStyle(4, 0x69f0ae, 1);
      check.beginPath();
      check.moveTo(checkBounds.x + 7, checkBounds.y + 14);
      check.lineTo(checkBounds.x + 15, checkBounds.y + 22);
      check.lineTo(checkBounds.x + 23, checkBounds.y + 7);
      check.strokePath();
    }

    slider.clear();
    slider.fillStyle(0x0b0f0b, 1);
    slider.fillRoundedRect(sliderBounds.x, sliderBounds.y + 8, sliderBounds.width, 8, 4);
    slider.fillStyle(enabled ? 0x69f0ae : 0x777777, 1);
    slider.fillRoundedRect(
      sliderBounds.x,
      sliderBounds.y + 8,
      Math.max(6, knobX - sliderBounds.x),
      8,
      4,
    );
    slider.fillStyle(0xffffff, 1);
    slider.fillCircle(knobX, sliderBounds.y + 12, 10);
  }
}
