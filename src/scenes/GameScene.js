import Phaser from 'phaser';
import { evaluateAchievements } from '../achievements.js';
import { assetPath } from '../assetPath.js';
import {
  enterBossMusic,
  exitBossMusic,
  playSfx,
  preloadMusic,
  preloadSfx,
  syncMusic,
} from '../audio.js';
import {
  ARENA_BACKGROUNDS,
  BOSS_BACKGROUND,
  backgroundKey,
  backgroundPath,
  resolveBackground,
} from '../backgrounds.js';
import { buildRuntimeStats, getWeapon, MODS, WEAPONS } from '../catalog.js';
import { CFG } from '../config.js';
import { BOSS_SPRITES, ENEMY_SPRITES, RUNE_PROWLER_SPRITES } from '../enemies.js';
import TouchControls from '../input/touchControls.js';
import { touchActive } from '../input/touchMode.js';
import { Save } from '../save.js';
import { TUTORIAL_SCRIPT, TutorialController } from '../tutorial.js';
import { toggleFullscreen } from '../viewport.js';
import { addTouchButton, coverBackground } from './sceneUtils.js';

// Praise shown when a tutorial step is completed.
const TUTORIAL_PRAISE = ['Good job!', 'Great!', 'Nice!', 'Well done!', 'Awesome!', 'Perfect!'];
// Pause after each completed step before the next instruction appears.
const TUTORIAL_STEP_DELAY_MS = 2000;

const PLAYER_DIRECTIONS = [
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
  'north',
  'northeast',
];
const PLAYER_POSES = ['idle', 'walk1', 'walk2', 'dash', 'hit', 'death'];
const PLAYER_BODY_SCALE = 0.78;
const PLAYER_WEAPON_SCALE = 0.34;
const PLAYER_WEAPON_OFFSET = 8;
const PLAYER_BULLET_OFFSET = 28;
const PLAYER_HITBOX = { width: 18, height: 26, offsetX: 23, offsetY: 28 };
const ENEMY_MONSTER_FRAME = { width: 64, height: 64 };
const ENEMY_MONSTER_SCALE = 0.58;
const DASHER_MONSTER_SCALE = 0.64;
const FIRECASTER_SCALE = 0.58;
const DEFAULT_ENEMY_SCALE = 0.58;
const ENEMY_HITBOX_MULT = 1.35;
const RUNE_PROWLER_SCALE = 0.27;
// Kill-burst shards render above gameplay/FX (enemies 4, bullets/boss FX ≤4.7)
// but below the HUD (≥20) so they never cover score/combo readouts.
const KILL_SHARD_DEPTH = 7;
const ENEMY_TYPE_ORDER = [
  'sniper',
  'teleporter',
  'shielded',
  'summoner',
  'healer',
  'slime',
  'egg',
  'bomber',
  'splitter',
  'tank',
  'firecaster',
  'dasher',
];
const CHEATS_ENABLED = import.meta.env.DEV;
// Shares the Store/Loadout icon key scheme so item textures are reused once loaded.
const loadoutIconKey = (id) => `store-item-${id}`;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    for (const direction of PLAYER_DIRECTIONS) {
      for (const pose of PLAYER_POSES) {
        const key = this.playerFrameKey(direction, pose);
        if (!this.textures.exists(key)) {
          this.load.image(key, assetPath(`assets/player/body/${direction}-${pose}.png`));
        }
      }
    }
    if (!this.textures.exists('player-rifle')) {
      this.load.image('player-rifle', assetPath('assets/player/rifle.png'));
    }
    for (const background of [...ARENA_BACKGROUNDS, BOSS_BACKGROUND]) {
      const key = backgroundKey(background.id);
      if (!this.textures.exists(key)) {
        this.load.image(key, backgroundPath(background));
      }
    }
    for (const sprite of Object.values(ENEMY_SPRITES)) {
      if (!this.textures.exists(sprite.key)) {
        this.load.spritesheet(sprite.key, sprite.path, {
          frameWidth: sprite.frameWidth,
          frameHeight: sprite.frameHeight,
        });
      }
    }
    const baseSpriteKeys = new Set(Object.values(ENEMY_SPRITES).map((sprite) => sprite.key));
    for (const boss of Object.values(BOSS_SPRITES)) {
      for (const sprite of Object.values(boss)) {
        if (!baseSpriteKeys.has(sprite.key) && !this.textures.exists(sprite.key)) {
          this.load.image(sprite.key, sprite.path);
        }
      }
    }
    for (const sprite of Object.values(RUNE_PROWLER_SPRITES)) {
      if (!this.textures.exists(sprite.key)) this.load.image(sprite.key, sprite.path);
    }
    // HUD loadout icons: reuse the store/loadout icon key scheme so textures are
    // shared once loaded.
    const save = Save.get();
    const loadoutIds = [
      ...(save.loadout?.weapons || [save.loadout?.weapon]),
      ...(save.loadout?.mods || []),
    ].filter(Boolean);
    for (const id of loadoutIds) {
      const def = [...WEAPONS, ...MODS].find((it) => it.id === id);
      if (!def) continue;
      const key = loadoutIconKey(id);
      if (!this.textures.exists(key)) {
        this.load.image(key, assetPath(`assets/items/${id}.png`));
      }
    }
    preloadMusic(this);
    preloadSfx(this);
  }

  create(data = {}) {
    this.demo = !!data.demo;
    this.demoEnemyId = data.demoEnemyId || 'swarmer';
    this.demoReturn = data.returnScene || 'MonstersScene';
    // Tutorial mode: a real (waved) run where the player can't die and every
    // onboarding hint is forced. Distinct from `demo` (the Monsters sandbox,
    // which freezes wave progression and scoring).
    this.tutorial = !!data.tutorial;
    // Checkpoint continue: start the climb at an arbitrary wave (default 1).
    // Difficulty/boss cadence key off this.wave, so a mid-game start is scaled.
    this.startWave = Math.max(1, Math.floor(data.startWave) || 1);
    syncMusic(this);
    // Live arena dimensions: 800x600 on desktop, wider (height fixed at 600) on
    // mobile. Spawn/clamp/HUD code reads these so it self-adjusts after a resize.
    this.arenaW = this.scale.width;
    this.arenaH = this.scale.height;
    this.physics.world.setBounds(0, 0, this.arenaW, this.arenaH);

    const save = Save.get();
    const selectedBackground = resolveBackground(save.settings?.backgroundId);
    // The player's chosen background stays the base layer at all times; boss waves
    // cross-fade a hell-arena overlay on top (see enter/exitBossBackground).
    this.selectedBackgroundKey = backgroundKey(selectedBackground.id);
    this.bgImage = coverBackground(this, this.selectedBackgroundKey).setDepth(-20);
    this.bossBgImage = null;
    this.bossBackgroundActive = false;
    const weaponIds = save.loadout?.weapons || [save.loadout?.weapon || 'pistol', null];
    this.weapons = [
      getWeapon(weaponIds[0] || 'pistol'),
      weaponIds[1] ? getWeapon(weaponIds[1]) : null,
    ];
    this.activeWeaponIndex = 0;
    this.weaponDef = this.weapons[0];

    this.tempMod = null;
    this.tempModEndsAt = 0;
    this.tempPhoenixActive = false;
    this.computeRuntime();
    this.phoenixCharges = this.modStats.phoenixCharges;

    this.score = 0;
    this.wave = 0;
    this.comboMultiplier = 1;
    this.lastKillAt = 0;
    this.dashReadyAnnounced = true;
    this.enemySpeedThisWave = CFG.enemy.speed;
    this.pendingSpawns = 0;
    // Total enemies scheduled for the current normal wave; drives the wave
    // progress bar/counter (remaining = pendingSpawns + live enemies).
    this.waveTotalEnemies = 0;
    this.paused = false;
    this.gameOver = false;

    // Bullet-time (slow-motion) state; see triggerSlowMo()/endSlowMo().
    this.slowMoActive = false;
    this.slowMoTimer = null;

    this.coinsThisRun = 0;
    this.burstShotsRemaining = 0;
    this.burstNextAt = 0;
    this.lastLaserSfxAt = -Infinity;

    // Per-run breakdown surfaced on the game-over summary screen.
    this.runStats = {
      startTime: 0, // set when the first wave starts (after create() boot work)
      killsByType: {},
      bosses: 0,
      longestCombo: 1,
      shotsFired: 0,
      shotsHit: 0,
      bossNoHit: false,
    };
    this.bossHitTaken = false;

    this.aimAngle = 0;
    this.lastMoveDir = { x: 1, y: 0 };

    this.shieldActive = false;
    this.shieldHitsRemaining = 0;
    this.shieldFromPickup = false; // gold-star shield (rewards unused hits) vs Phoenix shield
    this.shieldEndsAt = 0;
    this.shieldRing = null;
    this.shieldPickup = null;
    this.shieldDespawnEvent = null;
    this.shieldWarnEvent = null;
    this.shieldPickupOverlap = null;

    this.giftPickup = null;
    this.giftDespawnEvent = null;
    this.giftWarnEvent = null;
    this.giftPickupOverlap = null;

    this.cheatPromptActive = false;
    this.cheatBuffer = '';
    this.preCheatPaused = false;
    this.activeSpawnEvent = null;
    this.nextWaveDelayedCall = null;
    // Reset with the other spawn guards: the scene instance is reused across
    // scene.start(), so a run that ended/restarted mid inter-wave gap (with this
    // flag still true and its clearing timer shut down) would otherwise leave
    // maybeStartNextWave() permanently short-circuited — waves never advance.
    this.nextWaveScheduled = false;

    this.boss = null;
    this.bossActive = false;
    this.bossSpawning = false;
    this.bossShadow = null;
    this.bossShadowEvent = null;
    this.bossEffects = []; // timed boss attacks (beam sweep, gravity well, red dots)

    this.player = {
      sprite: null,
      barrel: null,
      hp: this.runtime.maxHp,
      nextFireAt: 0,
      dashEndsAt: 0,
      dashReadyAt: 0,
      invulnerableUntil: 0,
      dashDir: { x: 0, y: 0 },
      facing: 'south',
      hitUntil: 0,
      shootUntil: 0,
    };

    this.spawnPlayer();

    this.bullets = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group();
    this.hazards = this.physics.add.group();
    this.enemies = this.physics.add.group();
    this.coins = this.physics.add.group();

    this.physics.add.overlap(this.player.sprite, this.coins, this.onPlayerCoin, null, this);

    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      dash: Phaser.Input.Keyboard.KeyCodes.SPACE,
      pauseP: Phaser.Input.Keyboard.KeyCodes.P,
      pauseEsc: Phaser.Input.Keyboard.KeyCodes.ESC,
      switchWeapon: Phaser.Input.Keyboard.KeyCodes.C,
    });
    this.cursors = this.input.keyboard.createCursorKeys();

    // Touch controls: built only on touch devices. When null, every input path
    // below falls back to keyboard/mouse exactly as before.
    this.touchMode = touchActive();
    this.touch = this.touchMode ? new TouchControls(this) : null;

    // Desktop (mouse) only: swap to the sniper-target reticle while in the arena.
    // crosshair is the fallback if the image fails to load. Reset on shutdown so
    // the custom cursor never leaks into the menu scenes (shared canvas element).
    if (!this.touchMode) {
      this.input.setDefaultCursor(
        `url(${assetPath('assets/cursor/snipper_target_cursor.png')}) 24 24, crosshair`,
      );
    }

    // Reflow live (no restart) when the canvas resizes — mobile rotate or a
    // fullscreen toggle. Cleaned up on shutdown so it never fires on a dead scene.
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.boss) this.cancelBossAction(this.boss);
      // Belt-and-suspenders: never let the boss track leak into a menu scene.
      exitBossMusic(this);
      this.exitBossBackground(true);
      this.touch?.destroy();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      this.input.setDefaultCursor('default');
      this.destroyKillShards();
      this.cancelSlowMo();
    });

    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitEnemy, null, this);
    this.physics.add.overlap(this.player.sprite, this.enemies, this.onPlayerHitEnemy, null, this);
    this.physics.add.overlap(
      this.player.sprite,
      this.enemyProjectiles,
      this.onPlayerHitEnemyProjectile,
      null,
      this,
    );
    this.physics.add.overlap(this.player.sprite, this.hazards, this.onPlayerHitHazard, null, this);

    this.createEnemyAnimations();
    this.createBoomerangTexture();
    this.createHeartTextures();
    this.initKillBurst();
    this.createHUD();

    this.input.keyboard.on('keydown', this.onKeyDown, this);
    this.input.on('pointerdown', this.onPointerDown, this);

    if (this.demo) {
      this.startDemo();
    } else if (this.tutorial) {
      this.startTutorial();
    } else {
      this.runStats.startTime = this.time.now;
      playSfx(this, 'gameStart');
      this.beginAtWave(this.startWave);
      this.scheduleNextShieldBonus();
      this.scheduleNextGift();
    }
  }

  // ── Interactive tutorial ────────────────────────────────────────────────
  // A fully scripted, step-by-step lesson launched only from the menu's
  // TUTORIAL action — never on START. Each step: freeze the arena and show an
  // explanation → player acknowledges → player performs the action in the live
  // arena →
  // advance. The player cannot die; normal waves and random pickups are off.

  startTutorial() {
    Save.markTutorialSeen();
    this.tut = new TutorialController(TUTORIAL_SCRIPT);
    this.tutorialFinished = false;
    this.tutorialFrozen = false;
    this.tutorialAwaitingAck = false;
    this.enemySpeedThisWave = 0; // tutorial targets are stationary dummies
    // Keep the combo alive for the whole lesson so the combo step is reliable.
    this.runtime.comboResetMs = 999999;
    this.createTutorialUI();
    this.enterTutorialStep();
  }

  createTutorialUI() {
    const style = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', color: '#ffffff' };
    const cx = this.arenaW / 2;
    const cy = this.arenaH / 2;
    const w = 600;
    const h = 232;
    this.tutPanel = this.add
      .rectangle(cx, cy, w, h, 0x05140a, 0.93)
      .setStrokeStyle(2, 0x80d8ff, 0.9)
      .setDepth(1600)
      .setVisible(false);
    this.tutTitle = this.add
      .text(cx, cy - 80, '', { ...style, fontSize: '22px', color: '#80d8ff' })
      .setOrigin(0.5)
      .setDepth(1601)
      .setVisible(false);
    this.tutBody = this.add
      .text(cx, cy - 18, '', { ...style, fontSize: '15px', align: 'center' })
      .setOrigin(0.5)
      .setDepth(1601)
      .setVisible(false);
    this.tutPrompt = this.add
      .text(cx, cy + 84, '', { ...style, fontSize: '13px', color: '#ffd54f' })
      .setOrigin(0.5)
      .setDepth(1601)
      .setVisible(false);
    this.tutObjective = this.add
      .text(cx, this.arenaH - 96, '', {
        ...style,
        fontSize: '15px',
        color: '#cdeffd',
        backgroundColor: '#000000cc',
        padding: { x: 12, y: 7 },
      })
      .setOrigin(0.5, 1)
      .setDepth(40)
      .setVisible(false);
  }

  // Begin a step: freeze the arena and show its explanation panel.
  enterTutorialStep() {
    const step = this.tut.current();
    if (!step) {
      this.finishTutorial();
      return;
    }
    this.clearTutorialEntities();
    this.tutorialFrozen = true;
    this.physics.pause();
    this.tutObjective.setVisible(false);
    const continueHint = this.touchMode
      ? 'tap to continue'
      : 'press SPACE / ENTER / click to continue';
    this.showTutorialPanel(step.title, step.body, continueHint);
    this.tutorialAwaitingAck = true;
  }

  showTutorialPanel(title, body, prompt) {
    this.tutPanel.setVisible(true);
    this.tutTitle.setText(title).setVisible(true);
    this.tutBody.setText(body).setVisible(true);
    this.tutPrompt.setText(prompt).setVisible(true);
  }

  hideTutorialPanel() {
    this.tutPanel.setVisible(false);
    this.tutTitle.setVisible(false);
    this.tutBody.setVisible(false);
    this.tutPrompt.setVisible(false);
  }

  // Player dismissed the current panel.
  acknowledgeTutorial() {
    if (!this.tutorialAwaitingAck) return;
    this.tutorialAwaitingAck = false;
    if (this.tutorialFinished) {
      this.exitToMainMenu();
      return;
    }
    const phase = this.tut.acknowledge();
    if (phase === 'done') {
      this.finishTutorial();
      return;
    }
    // Begin the action phase: unfreeze and set up the step's scenario.
    this.hideTutorialPanel();
    this.physics.resume();
    this.tutorialFrozen = false;
    this.setupTutorialGoal(this.tut.current());
  }

  // Reset per-step trackers and spawn whatever the goal needs.
  setupTutorialGoal(step) {
    this.tutorialKills = 0;
    this.tutorialCoins = 0;
    this.tutorialDashed = false;
    this.tutorialGiftGot = false;
    this.tutorialShieldGot = false;
    this.tutorialMoveDist = 0;
    this.comboMultiplier = 1;
    this.tutorialLastPos = { x: this.player.sprite.x, y: this.player.sprite.y };
    this.tutObjective.setText(`➤ ${step.task}`).setVisible(true);

    const cx = this.arenaW / 2;
    const cy = this.arenaH / 2;
    switch (step.goal.type) {
      case 'kill':
        this.spawnTutorialTarget(cx, cy - 150);
        break;
      case 'combo':
        this.spawnComboTargets(step.goal.amount);
        break;
      case 'coin': {
        // Drop the player in the bottom-left corner so they have to walk across
        // to the coin cluster in the middle of the screen to collect it.
        const startX = 70;
        const startY = this.arenaH - 70;
        this.player.sprite.body.reset(startX, startY);
        this.tutorialLastPos = { x: startX, y: startY };
        this.spawnCoins(cx, cy, Math.max(1, step.goal.amount));
        // Tutorial coins must wait for the player instead of timing out, so the
        // step is always completable. Clear the despawn deadline set by
        // spawnCoins (mirrors keepTutorialPickup for gift/shield pickups).
        this.coins.getChildren().forEach((coin) => {
          coin.expiresAt = null;
        });
        break;
      }
      case 'gift':
        this.spawnGift();
        this.keepTutorialPickup('gift'); // stop it despawning, KEEP the overlap
        break;
      case 'shield':
        this.spawnShieldBonus();
        this.keepTutorialPickup('shield');
        break;
      default:
        break; // move / dash / ack need no scenario
    }
  }

  // Cancel a pickup's despawn/warn timers so it waits for the player, while
  // leaving its collection overlap intact (clearGiftTimers/clearShieldPickupTimers
  // also destroy the overlap, which would make the pickup uncollectable).
  keepTutorialPickup(kind) {
    if (kind === 'gift') {
      this.giftDespawnEvent?.remove(false);
      this.giftDespawnEvent = null;
      this.giftWarnEvent?.remove(false);
      this.giftWarnEvent = null;
    } else {
      this.shieldDespawnEvent?.remove(false);
      this.shieldDespawnEvent = null;
      this.shieldWarnEvent?.remove(false);
      this.shieldWarnEvent = null;
    }
  }

  // A stationary swarmer used as a shooting target during the tutorial.
  spawnTutorialTarget(x, y) {
    this.createSwarmer(x, y);
    const enemy = this.enemies.getChildren()[this.enemies.getChildren().length - 1];
    if (enemy) enemy.speed = 0;
  }

  // Spread `n` stationary targets in a ring around the arena centre.
  spawnComboTargets(n) {
    const cx = this.arenaW / 2;
    const cy = this.arenaH / 2;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2;
      this.spawnTutorialTarget(cx + Math.cos(a) * 150, cy + Math.sin(a) * 120);
    }
  }

  // Poll the current goal. Returns true when satisfied.
  checkTutorialGoal(step) {
    switch (step.goal.type) {
      case 'move': {
        const p = this.player.sprite;
        this.tutorialMoveDist += Math.hypot(
          p.x - this.tutorialLastPos.x,
          p.y - this.tutorialLastPos.y,
        );
        this.tutorialLastPos = { x: p.x, y: p.y };
        return this.tutorialMoveDist >= step.goal.amount;
      }
      case 'kill':
        return this.tutorialKills >= step.goal.amount;
      case 'dash':
        return this.tutorialDashed;
      case 'combo':
        // Require all targets to be destroyed (the combo rises as they fall).
        return this.tutorialKills >= step.goal.amount;
      case 'coin':
        return this.tutorialCoins >= step.goal.amount;
      case 'gift':
        return this.tutorialGiftGot;
      case 'shield':
        return this.tutorialShieldGot;
      default:
        return false;
    }
  }

  // Per-frame tutorial driver (called from update during the action phase).
  updateTutorial() {
    if (this.tutorialFrozen || this.tutorialFinished) return;
    const step = this.tut.current();
    if (!step || this.tut.phase !== 'act') return;
    if (this.checkTutorialGoal(step)) {
      this.completeTutorialStep(step);
      return;
    }
    // Combo step: if the targets are gone but the player hasn't destroyed enough
    // yet, top them back up so there's always something to shoot.
    if (step.goal.type === 'combo' && this.enemies.countActive(true) === 0) {
      const remaining = step.goal.amount - (this.tutorialKills || 0);
      if (remaining > 0) this.spawnComboTargets(remaining);
    }
  }

  completeTutorialStep(step) {
    this.tut.complete();
    this.tutObjective.setVisible(false);
    this.clearTutorialEntities();
    this.showTutorialToast(step.success);
    // The arena stays live during this 2s praise window: the player can keep
    // moving until the next explanation panel (which freezes the game) appears.
    // Uniform 2s pause (showing the praise) after every completed step before
    // the next instruction appears.
    this.time.delayedCall(TUTORIAL_STEP_DELAY_MS, () => this.enterTutorialStep());
  }

  // A cheerful praise word (line 1) over the step's detail (line 2).
  showTutorialToast(detail) {
    const praise = Phaser.Utils.Array.GetRandom(TUTORIAL_PRAISE);
    const cx = this.arenaW / 2;
    const cy = this.arenaH / 2;
    const big = this.add
      .text(cx, cy - 140, praise, {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '30px',
        color: '#69f0ae',
      })
      .setOrigin(0.5)
      .setDepth(1602);
    const small = this.add
      .text(cx, cy - 108, detail, {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '15px',
        color: '#cdeffd',
      })
      .setOrigin(0.5)
      .setDepth(1602);
    this.tweens.add({
      targets: [big, small],
      y: '-=24',
      alpha: { from: 1, to: 0 },
      delay: 600,
      duration: 1100,
      ease: 'Quad.out',
      onComplete: () => {
        big.destroy();
        small.destroy();
      },
    });
  }

  finishTutorial() {
    this.clearTutorialEntities();
    this.tutorialFinished = true;
    this.tutorialFrozen = true;
    this.physics.pause();
    this.tutObjective.setVisible(false);
    const prompt = this.touchMode
      ? 'tap to return to the menu'
      : 'press SPACE / ENTER / click to return to the menu';
    this.showTutorialPanel(
      'TUTORIAL COMPLETE',
      "You've learned the basics:\nmove, fire, dash, combo, coins, gift, shield, bosses.\nReturn to the menu and start your first run!",
      prompt,
    );
    this.tutorialAwaitingAck = true;
  }

  // Wipe the arena between steps so each scenario starts clean.
  clearTutorialEntities() {
    this.enemies
      .getChildren()
      .slice()
      .forEach((e) => {
        this.cleanupEnemyExtras(e);
        e.destroy();
      });
    this.coins
      .getChildren()
      .slice()
      .forEach((c) => {
        c.destroy();
      });
    this.bullets
      .getChildren()
      .slice()
      .forEach((b) => {
        b.visual?.destroy();
        b.destroy();
      });
    if (this.giftPickup) this.despawnGift();
    if (this.shieldPickup) this.despawnShieldBonus();
    if (this.shieldActive) this.endShield();
  }

  // Monsters-menu sandbox: spawn one of a chosen monster so the player can watch
  // it. Player takes no damage, no coins/score, and the monster respawns on death.
  startDemo() {
    this.wave = 1;
    this.enemySpeedThisWave = CFG.enemy.speed;
    this.add
      .text(this.arenaW / 2, 16, `DEMO: ${this.demoEnemyId.toUpperCase()}  ·  Esc to exit`, {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '14px',
        color: '#b9d7b3',
      })
      .setOrigin(0.5, 0)
      .setDepth(30);
    this.spawnDemoEnemy();
  }

  spawnDemoEnemy() {
    if (this.gameOver || !this.demo) return;
    // Honor each monster's maxAlive cap in the sandbox too (e.g. summoners),
    // otherwise respawn-on-kill lets them pile up unbounded.
    const cfg = CFG[this.demoEnemyId];
    if (cfg?.maxAlive && this.countEnemiesByType(this.demoEnemyId) >= cfg.maxAlive) return;
    const { x, y } = this.pickSpawnEdge();
    this.createEnemyByType(this.demoEnemyId, x, y);
  }

  scheduleDemoRespawn() {
    this.time.delayedCall(700, () => this.spawnDemoEnemy());
  }

  // Builds this.modStats and this.runtime from the equipped mods, optionally
  // including a temporary gifted mod. phoenixCharges is managed separately so
  // recomputing mid-run never resets a used revive.
  computeRuntime(extraModId = null) {
    const loadoutMods = (Save.get().loadout?.mods || []).filter(Boolean);
    const ids = extraModId ? [...loadoutMods, extraModId] : loadoutMods;
    const m = buildRuntimeStats(ids);
    this.modStats = m;
    this.runtime = {
      maxHp: Math.max(1, CFG.player.hp + m.maxHpDelta),
      playerSpeed: CFG.player.speed * m.moveSpeedMult,
      dashSpeed: CFG.player.dashSpeed * m.dashSpeedMult,
      dashCooldownMs: CFG.player.dashCooldownMs * m.dashCooldownMult,
      bulletSpeed: CFG.bullet.speed * m.bulletSpeedMult,
      bulletLifetimeMs: CFG.bullet.lifetimeMs * m.bulletLifetimeMult,
      fireRateMult: m.fireRateMult,
      coinDropMult: m.coinDropMult,
      magnetRadius: CFG.coin.magnetRadius * m.magnetRangeMult,
      comboResetMs: CFG.combo.resetMs + m.comboResetMsDelta,
      luckyChance: m.luckyChance,
      giftRateMult: m.giftRateMult,
    };
  }

  spawnPlayer() {
    const cx = this.arenaW / 2;
    const cy = this.arenaH / 2;

    const sprite = this.add.sprite(cx, cy, this.playerFrameKey('south', 'idle'));
    sprite.setScale(PLAYER_BODY_SCALE);
    sprite.setDepth(5);
    this.physics.add.existing(sprite);
    sprite.body.setCollideWorldBounds(true);
    sprite.body.setSize(PLAYER_HITBOX.width, PLAYER_HITBOX.height);
    sprite.body.setOffset(PLAYER_HITBOX.offsetX, PLAYER_HITBOX.offsetY);

    const barrel = this.add.image(cx, cy, 'player-rifle');
    barrel.setOrigin(0.28, 0.54);
    barrel.setScale(PLAYER_WEAPON_SCALE);
    barrel.setDepth(6);

    this.player.sprite = sprite;
    this.player.barrel = barrel;
  }

  playerFrameKey(direction, pose) {
    return `player-${direction}-${pose}`;
  }

  createEnemyAnimations() {
    for (const sprite of Object.values(ENEMY_SPRITES)) {
      if (!this.anims.exists(sprite.key)) {
        this.anims.create({
          key: sprite.key,
          frames: this.anims.generateFrameNumbers(sprite.key, {
            start: 0,
            end: (sprite.frames ?? 4) - 1,
          }),
          frameRate: 6,
          repeat: -1,
        });
      }
    }
  }

  createBoomerangTexture() {
    if (this.textures.exists('boomerang-bullet')) return;
    const g = this.add.graphics();
    const points = [
      { x: 4, y: 7 },
      { x: 16, y: 15 },
      { x: 28, y: 7 },
      { x: 25, y: 13 },
      { x: 16, y: 22 },
      { x: 7, y: 13 },
    ];
    g.fillStyle(0x29b6f6, 1);
    g.fillPoints(points, true);
    g.lineStyle(2, 0xe1f5fe, 1);
    g.strokePoints(points, true);
    g.generateTexture('boomerang-bullet', 32, 32);
    g.destroy();
  }

  // White heart textures for the HP pips: 'hp-heart' (filled) for remaining HP and
  // 'hp-heart-empty' (outline only) for lost HP. Both share one polygon so the empty
  // outline matches the filled shape exactly. Drawn white so renderHpPips can tint.
  createHeartTextures() {
    if (this.textures.exists('hp-heart')) return;
    // Sample a parametric heart curve into a closed polygon.
    const steps = 48;
    const raw = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      raw.push({
        x: 16 * Math.sin(t) ** 3,
        y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
      });
    }
    // Normalize into a padded, centered 28x28 box.
    const size = 28;
    const pad = 3;
    const xs = raw.map((p) => p.x);
    const ys = raw.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const scale = (size - pad * 2) / Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
    const offX = (size - (Math.max(...xs) - minX) * scale) / 2;
    const offY = (size - (Math.max(...ys) - minY) * scale) / 2;
    const points = raw.map((p) => ({
      x: offX + (p.x - minX) * scale,
      y: offY + (p.y - minY) * scale,
    }));

    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillPoints(points, true);
    g.generateTexture('hp-heart', size, size);
    g.clear();
    g.lineStyle(3, 0xffffff, 1);
    g.strokePoints(points, true);
    g.generateTexture('hp-heart-empty', size, size);
    g.destroy();
  }

  onPointerDown() {
    // A tap dismisses the tutorial explanation panel (works on touch too).
    if (this.tutorial && this.tutorialAwaitingAck) {
      this.acknowledgeTutorial();
      return;
    }
    // On touch, taps drive the virtual sticks/buttons; don't also recall
    // boomerangs (they auto-return via returningAfterMs).
    if (this.touchMode) return;
    if (this.paused || this.gameOver || this.cheatPromptActive) return;
    this.recallBoomerangs();
  }

  recallBoomerangs() {
    this.bullets.getChildren().forEach((bullet) => {
      if (bullet.isBoomerang && !bullet.recalled) {
        bullet.recalled = true;
        bullet.bulletReturned = true;
      }
    });
  }

  createHUD() {
    const style = {
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      fontSize: '16px',
      color: '#ffffff',
    };
    // HP is shown as discrete pips (see renderHpPips), not text. hpPipsX is the
    // left edge of the pip row; it shifts right on touch to clear the MENU button.
    this.hpPips = [];
    this.hpPipsX = 10;
    this.hudScore = this.add.text(10, 28, '', style);
    this.hudWave = this.add.text(this.arenaW - 10, 8, '', style).setOrigin(1, 0);
    this.hudCombo = this.add.text(this.arenaW - 10, 28, '', style).setOrigin(1, 0);

    // Wave progress: a small "N left" counter + a thin bar under the Wave/Combo
    // labels (top-right). Positioned in layoutHud(), updated in updateWaveProgress().
    const wp = CFG.hud.waveProgress;
    this.hudWaveLeft = this.add
      .text(this.arenaW - 10, 48, '', { ...style, fontSize: '12px', color: '#9ccc65' })
      .setOrigin(1, 0)
      .setVisible(false);
    this.waveBarBg = this.add
      .rectangle(0, 0, wp.barWidth, wp.barHeight, wp.bgColor, wp.bgAlpha)
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.waveBarFill = this.add
      .rectangle(0, 0, wp.barWidth, wp.barHeight, wp.fillColor)
      .setOrigin(0, 0.5)
      .setVisible(false);

    this.hudCoins = this.add
      .text(this.arenaW / 2, 8, '', { ...style, color: '#ffd54f' })
      .setOrigin(0.5, 0);

    this.buildPauseMenu(style);

    this.dashCdText = this.add
      .text(this.arenaW / 2, this.arenaH - 18, '', {
        ...style,
        fontSize: '12px',
        color: '#ffd54f',
      })
      .setOrigin(0.5, 1);

    this.hudWeapon = this.add
      .text(10, this.arenaH - 8, '', {
        ...style,
        fontSize: '12px',
        color: '#bbbbbb',
      })
      .setOrigin(0, 1);

    // Left column under HP/score: keeps top-center clear for the boss HP bar.
    this.shieldHud = this.add
      .text(10, 48, '', {
        ...style,
        fontSize: '14px',
        color: '#ffd54f',
      })
      .setOrigin(0, 0)
      .setVisible(false);

    this.giftHud = this.add
      .text(10, 66, '', {
        ...style,
        fontSize: '14px',
        color: '#ff80ab',
      })
      .setOrigin(0, 0)
      .setVisible(false);

    // Bottom-left loadout icons: the equipped weapon(s) and mods as small
    // pictures above the weapon text label. The active weapon is highlighted.
    this.createLoadoutIcons(style);

    const bar = CFG.boss.bar;
    const barLeft = bar.x - bar.width / 2;
    this.bossBarBg = this.add
      .rectangle(bar.x, bar.y, bar.width + 6, bar.height + 6, 0x000000, 0.6)
      .setStrokeStyle(2, 0xffffff, 0.5)
      .setDepth(20)
      .setVisible(false);
    this.bossHpFill = this.add
      .rectangle(barLeft, bar.y, bar.width, bar.height, 0xd32f2f)
      .setOrigin(0, 0.5)
      .setDepth(21)
      .setVisible(false);
    this.bossShieldFill = this.add
      .rectangle(barLeft, bar.y - bar.height / 2 - 4, bar.width, 5, CFG.boss.shieldColor)
      .setOrigin(0, 0.5)
      .setDepth(21)
      .setVisible(false);
    this.bossName = this.add
      .text(bar.x, bar.nameY, '', { ...style, fontSize: '18px', color: '#ff5252' })
      .setOrigin(0.5)
      .setDepth(21)
      .setVisible(false);
    this.bossPips = this.add
      .text(bar.x + bar.width / 2, bar.nameY, '', { ...style, fontSize: '13px', color: '#ffd54f' })
      .setOrigin(1, 0.5)
      .setDepth(21)
      .setVisible(false);

    if (CHEATS_ENABLED) {
      this.cheatBg = this.add
        .rectangle(this.arenaW / 2, this.arenaH / 2, 460, 180, 0x000000, 0.85)
        .setStrokeStyle(2, 0xffd54f)
        .setVisible(false);
      this.cheatTitle = this.add
        .text(this.arenaW / 2, this.arenaH / 2 - 52, 'CHEAT CONSOLE', {
          ...style,
          fontSize: '22px',
          color: '#ffd54f',
        })
        .setOrigin(0.5)
        .setVisible(false);
      this.cheatInput = this.add
        .text(this.arenaW / 2, this.arenaH / 2, '_', {
          ...style,
          fontSize: '24px',
        })
        .setOrigin(0.5)
        .setVisible(false);
      this.cheatHint = this.add
        .text(
          this.arenaW / 2,
          this.arenaH / 2 + 52,
          'wave 10  ·  coins 500  ·  enter confirm  ·  esc cancel',
          { ...style, fontSize: '12px', color: '#999' },
        )
        .setOrigin(0.5)
        .setVisible(false);
    }

    // Touch players have no keyboard, so a top-left MENU button opens the pause
    // overlay; the overlay's own buttons (Resume / Restart / Settings / Quit) are
    // all tappable zones, so no separate touch buttons are needed.
    if (this.touchMode) {
      this.menuButton = addTouchButton(this, {
        x: 8,
        y: 6,
        width: 80,
        height: 38,
        label: 'MENU',
        fontSize: '14px',
        onClick: () => {
          if (this.demo) this.scene.start(this.demoReturn);
          else this.togglePause();
        },
      });
      // Keep the left HUD (HP pips + score) clear of the MENU button.
      this.hpPipsX = 96;
      this.hudScore.setX(96);
    }

    this.layoutHud();
    this.updateHUD();
  }

  // Builds the bottom-left loadout strip: a framed icon per equipped weapon
  // (1–2) followed by a framed icon per equipped mod (0–2). Positioning is done
  // in layoutLoadoutIcons so the strip reflows on resize without rebuilding.
  createLoadoutIcons(style) {
    const SIZE = 34;
    const makeSlot = (id, accent) => {
      const key = loadoutIconKey(id);
      const hasIcon = this.textures.exists(key);
      const frame = this.add
        .rectangle(0, 0, SIZE, SIZE, 0x000000, 0.45)
        .setStrokeStyle(2, accent, 0.9)
        .setOrigin(0.5)
        .setDepth(15);
      const icon = this.add
        .image(0, 0, hasIcon ? key : '__DEFAULT')
        .setDisplaySize(SIZE - 6, SIZE - 6)
        .setOrigin(0.5)
        .setDepth(16)
        .setVisible(hasIcon);
      const label = hasIcon
        ? null
        : this.add
            .text(0, 0, (id[0] || '?').toUpperCase(), {
              ...style,
              fontSize: '16px',
            })
            .setOrigin(0.5)
            .setDepth(16);
      return { frame, icon, label, accent };
    };

    this.loadoutWeaponSlots = [];
    for (const weapon of this.weapons) {
      if (weapon) this.loadoutWeaponSlots.push(makeSlot(weapon.id, 0x4fc3f7));
    }
    this.loadoutModSlots = [];
    for (const id of (Save.get().loadout?.mods || []).filter(Boolean)) {
      this.loadoutModSlots.push(makeSlot(id, 0xffb74d));
    }

    this.updateLoadoutIconHighlight();
    this.layoutLoadoutIcons();
  }

  // Lays the loadout strip left-to-right above the weapon text label, weapons
  // first then a small gap then mods. Anchored to the live arena height.
  layoutLoadoutIcons() {
    const h = this.arenaH;
    const SIZE = 34;
    const GAP = 4;
    const GROUP_GAP = 12;
    const cy = h - 28 - SIZE / 2;
    let cx = 10 + SIZE / 2;
    const place = (slot) => {
      slot.frame.setPosition(cx, cy);
      slot.icon.setPosition(cx, cy);
      slot.label?.setPosition(cx, cy);
      cx += SIZE + GAP;
    };
    for (const slot of this.loadoutWeaponSlots || []) place(slot);
    if (this.loadoutModSlots?.length) cx += GROUP_GAP;
    for (const slot of this.loadoutModSlots || []) place(slot);
  }

  // Brightens the active weapon's frame/icon and dims the inactive one so the
  // player can see at a glance which weapon [C] is currently firing.
  updateLoadoutIconHighlight() {
    (this.loadoutWeaponSlots || []).forEach((slot, i) => {
      const active = i === this.activeWeaponIndex;
      slot.frame.setStrokeStyle(2, slot.accent, active ? 1 : 0.3);
      slot.frame.setFillStyle(0x000000, active ? 0.55 : 0.3);
      slot.icon.setAlpha(active ? 1 : 0.4);
      slot.label?.setAlpha(active ? 1 : 0.4);
    });
  }

  // Repositions every center/right/bottom-anchored HUD element from the live
  // arena size. Left-anchored items (HP/score at x=10) never move. Called once at
  // the end of createHUD and again from handleResize so the HUD reflows on a
  // mobile rotate / fullscreen toggle without rebuilding anything.
  layoutHud() {
    const w = this.arenaW;
    const h = this.arenaH;
    this.hudWave?.setPosition(w - 10, 8);
    this.hudCombo?.setPosition(w - 10, 28);
    this.hudWaveLeft?.setPosition(w - 10, 48);
    const wp = CFG.hud.waveProgress;
    this.waveBarBg?.setPosition(w - 10 - wp.barWidth, 70);
    this.waveBarFill?.setPosition(w - 10 - wp.barWidth, 70);
    this.hudCoins?.setPosition(w / 2, 8);
    this.layoutPauseMenu();
    this.dashCdText?.setPosition(w / 2, h - 18);
    this.hudWeapon?.setPosition(10, h - 8);
    this.shieldHud?.setPosition(10, 48);
    this.giftHud?.setPosition(10, 66);
    this.layoutLoadoutIcons();
    this.tutPanel?.setPosition(w / 2, h / 2);
    this.tutTitle?.setPosition(w / 2, h / 2 - 80);
    this.tutBody?.setPosition(w / 2, h / 2 - 18);
    this.tutPrompt?.setPosition(w / 2, h / 2 + 84);
    this.tutObjective?.setPosition(w / 2, h - 96);

    const bar = CFG.boss.bar;
    const barLeft = w / 2 - bar.width / 2;
    this.bossBarBg?.setPosition(w / 2, bar.y);
    this.bossHpFill?.setPosition(barLeft, bar.y);
    this.bossShieldFill?.setPosition(barLeft, bar.y - bar.height / 2 - 4);
    this.bossName?.setPosition(w / 2, bar.nameY);
    this.bossPips?.setPosition(w / 2 + bar.width / 2, bar.nameY);

    if (this.cheatBg) {
      this.cheatBg.setPosition(w / 2, h / 2);
      this.cheatTitle.setPosition(w / 2, h / 2 - 52);
      this.cheatInput.setPosition(w / 2, h / 2);
      this.cheatHint.setPosition(w / 2, h / 2 + 52);
    }
    this.waveBanner?.setPosition(w / 2, 60);
  }

  // Live resize handler (mobile rotate / fullscreen toggle). Updates the arena
  // dimensions, world bounds, background fit, HUD and touch-control anchors in
  // place — no scene restart, so an in-progress run is never lost.
  handleResize() {
    this.arenaW = this.scale.width;
    this.arenaH = this.scale.height;
    this.physics.world.setBounds(0, 0, this.arenaW, this.arenaH);
    if (this.bgImage) coverBackground(this, this.bgImage.texture.key, this.bgImage);
    if (this.bossBgImage) coverBackground(this, this.bossBgImage.texture.key, this.bossBgImage);
    this.layoutHud();
    this.touch?.layout();
  }

  update(time, delta) {
    if (this.gameOver) return;
    if (this.cheatPromptActive) return;

    this.touch?.update();

    if (
      Phaser.Input.Keyboard.JustDown(this.keys.pauseP) ||
      Phaser.Input.Keyboard.JustDown(this.keys.pauseEsc) ||
      this.touch?.consumePause()
    ) {
      if (this.demo) {
        this.scene.start(this.demoReturn);
        return;
      }
      if (this.tutorial) {
        this.exitToMainMenu();
        return;
      }
      // While the settings sub-panel is open, P/Esc backs out to the button list
      // instead of resuming the game outright.
      if (this.paused && this.pauseView === 'settings') {
        this.closePauseSettings();
      } else {
        this.togglePause();
      }
    }

    if (this.paused) return;

    // While a tutorial explanation panel (or the completion panel) is up the
    // arena is frozen; only the aim indicator and HUD update.
    if (this.tutorial && this.tutorialFrozen) {
      this.updateAim();
      this.updateHUD(time);
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.switchWeapon) || this.touch?.consumeSwitch()) {
      this.switchWeapon(time);
    }

    this.updateAim();
    this.handleMovementAndDash(time);
    this.handleFire(time);
    this.updatePlayerVisuals(time);
    this.updateEnemies();
    this.updateBossEffects(time);
    this.updateBullets(time);
    this.updateEnemyProjectiles(time);
    this.updateHazards(time);
    this.updateCoins(time, delta);
    this.updateKillShards(delta);
    this.despawnExpiredBullets(time);
    this.maybeDecayCombo(time);
    this.updateShield(time);
    this.updateTempMod(time);
    this.maybeStartNextWave();
    if (this.tutorial) this.updateTutorial();
    this.updateHUD(time);
  }

  updateBullets(time) {
    this.bullets.getChildren().forEach((bullet) => {
      const mods = bullet.bulletMods;
      if (!mods) return;
      if (bullet.isBoomerang) {
        const autoReturn =
          mods.returningAfterMs && time - bullet.bulletBornAt >= mods.returningAfterMs;
        // On recall or after the return delay, home back to the player's current
        // position so the boomerang always comes back to the player.
        if (bullet.recalled || autoReturn) {
          bullet.bulletReturned = true;
          const px = this.player.sprite.x;
          const py = this.player.sprite.y;
          const dx = px - bullet.x;
          const dy = py - bullet.y;
          const dist = Math.hypot(dx, dy) || 1;
          const returnSpeed = bullet.bulletSpeed * (bullet.recalled ? 1.9 : 1.2);
          bullet.body.setVelocity((dx / dist) * returnSpeed, (dy / dist) * returnSpeed);
          if (dist < 20) {
            bullet.destroy();
            return;
          }
        }
        if (bullet.visual) {
          bullet.visual.x = bullet.x;
          bullet.visual.y = bullet.y;
          bullet.visual.rotation += 0.45;
        }
        return;
      }
      if (mods.returningAfterMs && !bullet.bulletReturned) {
        if (time - bullet.bulletBornAt >= mods.returningAfterMs) {
          bullet.bulletReturned = true;
          bullet.body.setVelocity(-bullet.body.velocity.x, -bullet.body.velocity.y);
        }
      }
      if (bullet.isHomingSecond) {
        const target = this.nearestEnemy(bullet.x, bullet.y);
        if (target) {
          const dx = target.x - bullet.x;
          const dy = target.y - bullet.y;
          const len = Math.hypot(dx, dy) || 1;
          const vx = bullet.body.velocity.x;
          const vy = bullet.body.velocity.y;
          const turn = 0.08;
          const tx = (dx / len) * bullet.bulletSpeed;
          const ty = (dy / len) * bullet.bulletSpeed;
          bullet.body.setVelocity(vx * (1 - turn) + tx * turn, vy * (1 - turn) + ty * turn);
        }
      }
    });
  }

  nearestEnemy(x, y) {
    let best = null;
    let bestD = Infinity;
    this.enemies.getChildren().forEach((e) => {
      const d = Phaser.Math.Distance.Squared(x, y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    });
    return best;
  }

  updateCoins(time, _delta) {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const magnetRadius = this.runtime.magnetRadius;
    const gravityRadius = magnetRadius * CFG.coin.gravityRadiusMult;
    const magnetRadiusSq = magnetRadius * magnetRadius;
    const gravityRadiusSq = gravityRadius * gravityRadius;
    const maxSpeed = CFG.coin.maxSpeed;
    this.coins.getChildren().forEach((coin) => {
      // Small kill-drop coins despawn after CFG.coin.lifetimeMs so the arena does
      // not fill up with uncollected coins. Big boss-reward coins have no
      // expiresAt and never time out.
      if (coin.expiresAt != null) {
        const remaining = coin.expiresAt - time;
        if (remaining <= 0) {
          coin.destroy();
          return;
        }
        if (remaining <= CFG.coin.warnLastMs) {
          coin.setAlpha(0.3 + 0.7 * Math.abs(Math.sin(time / 90)));
        }
      }
      const dx = px - coin.x;
      const dy = py - coin.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= gravityRadiusSq) {
        const dist = Math.sqrt(distSq) || 1;
        const inMagnetRange = distSq <= magnetRadiusSq;
        const pullSpeed = inMagnetRange ? CFG.coin.magnetSpeed : CFG.coin.gravitySpeed;
        const turn = inMagnetRange ? CFG.coin.magnetTurn : CFG.coin.gravityTurn;
        let vx = coin.body.velocity.x * CFG.coin.drag;
        let vy = coin.body.velocity.y * CFG.coin.drag;
        const targetVx = (dx / dist) * pullSpeed;
        const targetVy = (dy / dist) * pullSpeed;
        vx += (targetVx - vx) * turn;
        vy += (targetVy - vy) * turn;
        const sp = Math.hypot(vx, vy);
        if (sp > maxSpeed) {
          vx = (vx / sp) * maxSpeed;
          vy = (vy / sp) * maxSpeed;
        }
        coin.body.setVelocity(vx, vy);
      } else {
        coin.body.setVelocity(
          coin.body.velocity.x * CFG.coin.drag,
          coin.body.velocity.y * CFG.coin.drag,
        );
      }
    });
  }

  updateAim() {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    if (this.touch) {
      // Aim comes from the right stick only; keep the last angle when released.
      // (activePointer is ambiguous under multitouch.)
      const angle = this.touch.getAim();
      if (angle != null) this.aimAngle = angle;
      else if (this.aimAngle == null) this.aimAngle = 0;
    } else {
      const ptr = this.input.activePointer;
      this.aimAngle = Math.atan2(ptr.worldY - py, ptr.worldX - px);
    }
    this.player.barrel.x = px + Math.cos(this.aimAngle) * PLAYER_WEAPON_OFFSET;
    this.player.barrel.y = py + Math.sin(this.aimAngle) * PLAYER_WEAPON_OFFSET + 1;
    this.player.barrel.rotation = this.aimAngle;
    this.player.barrel.setFlipY(Math.cos(this.aimAngle) < 0);
  }

  updatePlayerVisuals(time) {
    const body = this.player.sprite.body;
    const moving = Math.abs(body.velocity.x) > 1 || Math.abs(body.velocity.y) > 1;
    if (moving) {
      this.player.facing = this.directionFromVector(body.velocity.x, body.velocity.y);
    }

    let pose = 'idle';
    if (this.gameOver) pose = 'death';
    else if (time < this.player.hitUntil) pose = 'hit';
    else if (time < this.player.dashEndsAt) pose = 'dash';
    else if (moving) pose = Math.floor(time / 140) % 2 === 0 ? 'walk1' : 'walk2';

    this.player.sprite.setTexture(this.playerFrameKey(this.player.facing, pose));

    const shooting = time < this.player.shootUntil;
    this.player.barrel.setScale(PLAYER_WEAPON_SCALE * (shooting ? 1.08 : 1));
  }

  directionFromVector(x, y) {
    const angle = Math.atan2(y, x);
    const wrapped = Phaser.Math.Angle.Wrap(angle + Math.PI / 8);
    const index = Math.floor(Phaser.Math.Angle.Normalize(wrapped) / (Math.PI / 4));
    return PLAYER_DIRECTIONS[index % PLAYER_DIRECTIONS.length];
  }

  handleMovementAndDash(time) {
    let vx;
    let vy;
    if (this.touch) {
      const m = this.touch.getMove();
      vx = m.x;
      vy = m.y;
    } else {
      const k = this.keys;
      const c = this.cursors;
      const left = k.left.isDown || c.left.isDown;
      const right = k.right.isDown || c.right.isDown;
      const up = k.up.isDown || c.up.isDown;
      const down = k.down.isDown || c.down.isDown;
      vx = (right ? 1 : 0) - (left ? 1 : 0);
      vy = (down ? 1 : 0) - (up ? 1 : 0);
    }

    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      vx /= len;
      vy /= len;
      this.lastMoveDir = { x: vx, y: vy };
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.dash) || this.touch?.consumeDash()) {
      this.tryDash(time, vx, vy);
    }

    const body = this.player.sprite.body;
    if (time < this.player.dashEndsAt) {
      body.setVelocity(
        this.player.dashDir.x * this.runtime.dashSpeed,
        this.player.dashDir.y * this.runtime.dashSpeed,
      );
    } else {
      body.setVelocity(vx * this.runtime.playerSpeed, vy * this.runtime.playerSpeed);
    }
  }

  tryDash(time, intentX, intentY) {
    if (time < this.player.dashReadyAt) return;

    let dx = intentX;
    let dy = intentY;
    if (dx === 0 && dy === 0) {
      dx = Math.cos(this.aimAngle);
      dy = Math.sin(this.aimAngle);
    }
    this.player.dashDir = { x: dx, y: dy };
    this.player.dashEndsAt = time + CFG.player.dashDurationMs;
    this.player.dashReadyAt = time + this.runtime.dashCooldownMs;
    this.player.invulnerableUntil = this.player.dashEndsAt;
    this.tutorialDashed = true;
    playSfx(this, 'dash');

    this.tweens.add({
      targets: this.player.sprite,
      alpha: 0.4,
      duration: CFG.player.dashDurationMs / 2,
      yoyo: true,
      onComplete: () => {
        this.player.sprite.setAlpha(1);
      },
    });
  }

  handleFire(time) {
    const firing = this.touch ? this.touch.isFiring() : this.input.activePointer.isDown;
    if (!firing && this.burstShotsRemaining === 0) return;

    const weapon = this.weaponDef;
    const burst = weapon.fire.burst;

    // Burst weapons: pace shots independently of pointer state
    if (burst) {
      if (this.burstShotsRemaining > 0) {
        if (time < this.burstNextAt) return;
        this.fireWeaponShot(time);
        this.burstShotsRemaining -= 1;
        this.burstNextAt = time + burst.intraDelayMs;
        if (this.burstShotsRemaining === 0) {
          this.player.nextFireAt = time + burst.cooldownMs;
        }
        return;
      }
      if (!firing) return;
      if (time < this.player.nextFireAt) return;
      this.burstShotsRemaining = burst.count;
      this.burstNextAt = time;
      return;
    }

    if (time < this.player.nextFireAt) return;

    const weaponMods = weapon.fire.bulletMods;
    if (weaponMods?.hitscan) {
      this.fireLaser(time);
      this.player.nextFireAt = time + weapon.fire.rateMs * this.runtime.fireRateMult;
      return;
    }

    for (const offsetDeg of weapon.fire.angles) {
      this.fireBullet(time, offsetDeg);
    }
    this.playWeaponSfx(time);
    this.player.nextFireAt = time + weapon.fire.rateMs * this.runtime.fireRateMult;
  }

  fireLaser(time) {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const angle = this.aimAngle;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const reach = this.arenaW + this.arenaH;
    const ex = px + dirX * reach;
    const ey = py + dirY * reach;

    this.player.shootUntil = time + 90;

    const dmg = this.weaponDef.fire.bulletMods?.damage || 1;
    const pad = CFG.bullet.radius + 4;
    const targets = this.enemies.getChildren().slice();
    for (const enemy of targets) {
      if (!enemy.active) continue;
      const r = (enemy.body?.radius ? enemy.body.radius : 12) + pad;
      if (this.pointToSegmentDistance(enemy.x, enemy.y, px, py, ex, ey) <= r) {
        this.damageEnemy(enemy, px, py, dmg);
      }
    }
    this.maybeStartNextWave();

    playSfx(this, 'laser', 0.7);

    const beam = this.add.graphics().setDepth(4.6);
    beam.lineStyle(6, 0x29b6f6, 0.3);
    beam.lineBetween(px, py, ex, ey);
    beam.lineStyle(3, 0x4fc3f7, 0.85);
    beam.lineBetween(px, py, ex, ey);
    beam.lineStyle(1, 0xffffff, 1);
    beam.lineBetween(px, py, ex, ey);
    this.tweens.add({ targets: beam, alpha: 0, duration: 150, onComplete: () => beam.destroy() });
  }

  pointToSegmentDistance(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const lenSq = abx * abx + aby * aby || 1;
    const t = Phaser.Math.Clamp((apx * abx + apy * aby) / lenSq, 0, 1);
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    return Math.hypot(px - cx, py - cy);
  }

  fireWeaponShot(time) {
    for (const offsetDeg of this.weaponDef.fire.angles) {
      this.fireBullet(time, offsetDeg);
    }
    this.playWeaponSfx(time);
  }

  switchWeapon(time) {
    if (!this.weapons[1]) return;
    this.activeWeaponIndex = this.activeWeaponIndex === 0 ? 1 : 0;
    this.weaponDef = this.weapons[this.activeWeaponIndex];
    this.updateLoadoutIconHighlight();
    this.burstShotsRemaining = 0;
    this.player.nextFireAt = time + CFG.player.weaponSwapDelayMs;
    this.showFloatingText(
      this.player.sprite.x,
      this.player.sprite.y - 30,
      this.weaponDef.name,
      '#4fc3f7',
    );
    this.updateHUD(time);
  }

  playWeaponSfx(time) {
    if (!['beam', 'plasma'].includes(this.weaponDef.id)) return;
    if (time - this.lastLaserSfxAt < 120) return;
    this.lastLaserSfxAt = time;
    playSfx(this, 'laser', this.weaponDef.id === 'beam' ? 0.45 : 0.8);
  }

  fireBullet(time, offsetDeg = 0) {
    if (!this.demo) this.runStats.shotsFired += 1;
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const angle = this.aimAngle + (offsetDeg * Math.PI) / 180;
    const mods = this.weaponDef.fire.bulletMods || {};
    const sizeMult = mods.sizeMult || 1;
    const radius = CFG.bullet.radius * sizeMult;
    const speedMult = mods.speedMult || 1;
    const speed = this.runtime.bulletSpeed * speedMult;
    const lifetime = mods.lifetimeMsOverride
      ? mods.lifetimeMsOverride
      : this.runtime.bulletLifetimeMs;
    // Over the dark hell arena on boss waves, the standard dark bullet would
    // nearly disappear — switch to the light boss color (read per shot from the
    // same flag that drives the background swap).
    const baseColor = this.bossBackgroundActive ? CFG.bullet.bossColor : CFG.bullet.color;
    const color = mods.aoeRadius ? 0xff7043 : baseColor;

    this.player.shootUntil = time + 90;
    const spawnX = px + Math.cos(angle) * PLAYER_BULLET_OFFSET;
    const spawnY = py + Math.sin(angle) * PLAYER_BULLET_OFFSET;

    const bullet = this.add.circle(spawnX, spawnY, radius, color);
    // Dark-gray standard bullets need a thin light outline to stay readable over
    // darker arena backgrounds. AoE/boomerang bullets carry their own distinct look.
    if (!mods.aoeRadius && !mods.boomerang) {
      bullet.setStrokeStyle(1, 0xe0e0e0, 0.85);
    }
    this.physics.add.existing(bullet);
    this.bullets.add(bullet);
    bullet.body.setCircle(radius);
    bullet.body.setOffset(-radius, -radius);
    bullet.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    bullet.expiresAt = time + lifetime;
    bullet.bulletMods = mods;
    bullet.bulletSpeed = speed;
    bullet.bulletAngle = angle;
    bullet.bulletBornAt = time;
    bullet.bulletReturned = false;
    bullet.isHomingSecond = !!mods.homingSecondShot && offsetDeg > 0;
    bullet.isBoomerang = !!mods.boomerang;
    bullet.recalled = false;

    if (bullet.isBoomerang) {
      bullet.setVisible(false);
      const visual = this.add.image(spawnX, spawnY, 'boomerang-bullet').setDepth(4.7);
      visual.setScale((radius / 8) * 0.9);
      bullet.visual = visual;
      bullet.once('destroy', () => {
        if (bullet.visual) bullet.visual.destroy();
      });
    }
  }

  despawnExpiredBullets(time) {
    this.bullets.getChildren().forEach((bullet) => {
      // Boomerangs must be allowed to travel past the screen edge and fly back,
      // so they only despawn on lifetime expiry, never on leaving the bounds.
      if (bullet.isBoomerang) {
        if (time >= bullet.expiresAt) {
          bullet.destroy();
        }
        return;
      }
      if (
        time >= bullet.expiresAt ||
        bullet.x < -20 ||
        bullet.x > this.arenaW + 20 ||
        bullet.y < -20 ||
        bullet.y > this.arenaH + 20
      ) {
        bullet.destroy();
      }
    });
  }

  updateEnemyProjectiles(time) {
    this.enemyProjectiles.getChildren().forEach((projectile) => {
      if (
        time >= projectile.expiresAt ||
        projectile.x < -30 ||
        projectile.x > this.arenaW + 30 ||
        projectile.y < -30 ||
        projectile.y > this.arenaH + 30
      ) {
        projectile.destroy();
      }
    });
  }

  updateHazards(time) {
    this.hazards.getChildren().forEach((hazard) => {
      if (time >= hazard.expiresAt) {
        hazard.destroy();
      }
    });
  }

  pickSpawnEdge() {
    const side = Phaser.Math.Between(0, 3);
    const margin = 24;
    if (side === 0) return { x: Phaser.Math.Between(0, this.arenaW), y: -margin };
    if (side === 1) return { x: this.arenaW + margin, y: Phaser.Math.Between(0, this.arenaH) };
    if (side === 2) return { x: Phaser.Math.Between(0, this.arenaW), y: this.arenaH + margin };
    return { x: -margin, y: Phaser.Math.Between(0, this.arenaH) };
  }

  spawnEnemy() {
    const { x, y } = this.pickSpawnEdge();
    const type = this.pickEnemyType();
    this.createEnemyByType(type, x, y);
    this.pendingSpawns -= 1;
    if (this.pendingSpawns <= 0) {
      this.pendingSpawns = 0;
      this.activeSpawnEvent = null;
    }
  }

  pickEnemyType() {
    for (const type of ENEMY_TYPE_ORDER) {
      const cfg = CFG[type];
      if (!cfg) continue;
      if (this.wave < cfg.appearFromWave) continue;
      if (cfg.maxAlive && this.countEnemiesByType(type) >= cfg.maxAlive) continue;
      if (Math.random() < cfg.spawnRatio) return type;
    }
    return 'swarmer';
  }

  createEnemyByType(type, x, y) {
    if (type === 'dasher') this.createDasher(x, y);
    else if (type === 'firecaster') this.createFirecaster(x, y);
    else if (type === 'tank') this.createTank(x, y);
    else if (type === 'splitter') this.createSplitter(x, y);
    else if (type === 'splitter-child') this.createSplitterChild(x, y);
    else if (type === 'bomber') this.createBomber(x, y);
    else if (type === 'healer') this.createHealer(x, y);
    else if (type === 'summoner') this.createSummoner(x, y);
    else if (type === 'shielded') this.createShielded(x, y);
    else if (type === 'teleporter') this.createTeleporter(x, y);
    else if (type === 'sniper') this.createSniper(x, y);
    else if (type === 'egg') this.createEgg(x, y);
    else if (type === 'slime') this.createSlime(x, y);
    else this.createSwarmer(x, y);
  }

  countEnemiesByType(type) {
    return this.enemies.getChildren().filter((enemy) => enemy.type === type).length;
  }

  createSwarmer(x, y) {
    const enemy = this.createEnemySprite(x, y, 'monster', CFG.enemy, ENEMY_MONSTER_SCALE);
    enemy.speed = this.enemySpeedThisWave;
    enemy.hp = CFG.enemy.hp;
    enemy.maxHp = CFG.enemy.hp;
    enemy.type = 'swarmer';
  }

  createEnemySprite(x, y, spriteId, cfg, scale = DEFAULT_ENEMY_SCALE, tint = null) {
    const spriteDef = ENEMY_SPRITES[spriteId];
    const enemy = this.add.sprite(x, y, spriteDef.key, 0);
    this.physics.add.existing(enemy);
    this.enemies.add(enemy);
    const bodyRadius = cfg.radius * ENEMY_HITBOX_MULT;
    enemy.body.setCircle(bodyRadius);
    enemy.body.setOffset(
      ENEMY_MONSTER_FRAME.width / 2 - bodyRadius,
      ENEMY_MONSTER_FRAME.height / 2 - bodyRadius + 6,
    );
    enemy.setScale(scale);
    enemy.setDepth(4);
    if (tint) enemy.setTint(tint);
    enemy.play(spriteDef.key);
    return enemy;
  }

  createDasher(x, y) {
    const enemy = this.createEnemySprite(
      x,
      y,
      'monster',
      CFG.dasher,
      DASHER_MONSTER_SCALE,
      CFG.dasher.color,
    );
    enemy.speed = this.enemySpeedThisWave * CFG.dasher.walkSpeedFactor;
    enemy.hp = CFG.dasher.hp;
    enemy.maxHp = CFG.dasher.hp;
    enemy.type = 'dasher';
    enemy.baseTint = CFG.dasher.color;
    enemy.windupEndsAt = 0;
    enemy.dashEndsAt = 0;
    enemy.nextDashAt =
      this.time.now +
      Phaser.Math.Between(CFG.dasher.dashCooldownMinMs, CFG.dasher.dashCooldownMaxMs);
  }

  createFirecaster(x, y) {
    const enemy = this.createEnemySprite(x, y, 'firecaster', CFG.firecaster, FIRECASTER_SCALE);
    const speedWave = Math.min(this.wave, CFG.waves.speedCapWave);
    enemy.speed =
      CFG.firecaster.speed + CFG.waves.enemySpeedGrowth * Math.max(0, speedWave - 1) * 0.45;
    enemy.hp = CFG.firecaster.hp;
    enemy.maxHp = CFG.firecaster.hp;
    enemy.type = 'firecaster';
    enemy.baseTint = 0xffffff;
    enemy.windupEndsAt = 0;
    enemy.nextFireAt =
      this.time.now +
      Phaser.Math.Between(CFG.firecaster.fireCooldownMinMs, CFG.firecaster.fireCooldownMaxMs);
    enemy.strafeDir = Math.random() < 0.5 ? -1 : 1;
  }

  createTank(x, y) {
    const enemy = this.createEnemySprite(x, y, 'tank', CFG.tank, 0.82);
    enemy.speed = CFG.tank.speed;
    enemy.hp = CFG.tank.hp;
    enemy.maxHp = CFG.tank.hp;
    enemy.type = 'tank';
  }

  createSplitter(x, y) {
    const enemy = this.createEnemySprite(x, y, 'splitter', CFG.splitter, 0.62);
    enemy.speed = CFG.splitter.speed;
    enemy.hp = CFG.splitter.hp;
    enemy.maxHp = CFG.splitter.hp;
    enemy.type = 'splitter';
  }

  createSplitterChild(x, y) {
    const enemy = this.createEnemySprite(
      x,
      y,
      'splitter',
      {
        radius: CFG.splitter.childRadius,
      },
      0.38,
    );
    enemy.speed = CFG.splitter.childSpeed;
    enemy.hp = CFG.splitter.childHp;
    enemy.maxHp = CFG.splitter.childHp;
    enemy.type = 'splitter-child';
  }

  createBomber(x, y) {
    const enemy = this.createEnemySprite(x, y, 'bomber', CFG.bomber, 0.62);
    enemy.speed = CFG.bomber.speed;
    enemy.hp = CFG.bomber.hp;
    enemy.maxHp = CFG.bomber.hp;
    enemy.type = 'bomber';
    enemy.explodingAt = 0;
  }

  createHealer(x, y) {
    const enemy = this.createEnemySprite(x, y, 'healer', CFG.healer, 0.58);
    enemy.speed = CFG.healer.speed;
    enemy.hp = CFG.healer.hp;
    enemy.maxHp = CFG.healer.hp;
    enemy.type = 'healer';
    enemy.nextHealAt = this.time.now + CFG.healer.healCooldownMs;
  }

  createSummoner(x, y) {
    const enemy = this.createEnemySprite(x, y, 'summoner', CFG.summoner, 0.6);
    enemy.speed = CFG.summoner.speed;
    enemy.hp = CFG.summoner.hp;
    enemy.maxHp = CFG.summoner.hp;
    enemy.type = 'summoner';
    enemy.nextSummonAt = this.time.now + CFG.summoner.summonCooldownMs;
  }

  createShielded(x, y) {
    const enemy = this.createEnemySprite(x, y, 'shielded', CFG.shielded, 0.68);
    enemy.speed = CFG.shielded.speed;
    enemy.hp = CFG.shielded.hp;
    enemy.maxHp = CFG.shielded.hp;
    enemy.type = 'shielded';
    enemy.facingAngle = 0;
  }

  createTeleporter(x, y) {
    const enemy = this.createEnemySprite(x, y, 'teleporter', CFG.teleporter, 0.58);
    enemy.speed = CFG.teleporter.speed;
    enemy.hp = CFG.teleporter.hp;
    enemy.maxHp = CFG.teleporter.hp;
    enemy.type = 'teleporter';
    enemy.blinkAt = this.time.now + CFG.teleporter.blinkCooldownMs;
    enemy.windupEndsAt = 0;
  }

  createSniper(x, y) {
    const enemy = this.createEnemySprite(x, y, 'sniper', CFG.sniper, 0.6);
    enemy.speed = CFG.sniper.speed;
    enemy.hp = CFG.sniper.hp;
    enemy.maxHp = CFG.sniper.hp;
    enemy.type = 'sniper';
    enemy.nextShotAt = this.time.now + CFG.sniper.cooldownMs;
    enemy.aimEndsAt = 0;
    enemy.aimLine = null;
    enemy.aimDir = { x: 1, y: 0 };
  }

  createEgg(x, y) {
    const pad = 70;
    const sx = Phaser.Math.Clamp(x, pad, this.arenaW - pad);
    const sy = Phaser.Math.Clamp(y, pad, this.arenaH - pad);
    const enemy = this.createEnemySprite(sx, sy, 'egg', CFG.egg, 0.7);
    enemy.speed = 0;
    enemy.hp = CFG.egg.hp;
    enemy.maxHp = CFG.egg.hp;
    enemy.type = 'egg';
    enemy.nextHatchAt = this.time.now + CFG.egg.hatchCooldownMs;
    enemy.body.setVelocity(0, 0);
  }

  createSlime(x, y) {
    const enemy = this.createEnemySprite(x, y, 'slime', CFG.slime, 0.62);
    enemy.speed = CFG.slime.speed;
    enemy.hp = CFG.slime.hp;
    enemy.maxHp = CFG.slime.hp;
    enemy.type = 'slime';
    enemy.nextPuddleAt = this.time.now + CFG.slime.puddleCooldownMs;
  }

  // --- Boss: The Warden ------------------------------------------------------

  startBossWave(n) {
    this.bossActive = true;
    // Reset the no-hit tracker so a clean boss kill unlocks "Untouchable".
    this.bossHitTaken = false;
    this.pendingSpawns = 0;
    this.activeSpawnEvent = null;
    const tier = Math.floor(n / CFG.boss.everyNWaves);
    const variant = this.bossVariant(tier);
    const finalBoss = n >= CFG.boss.finalWave;
    this.showWaveBanner(
      `${finalBoss ? '☠ FINAL BOSS' : '⚠ BOSS'} — ${variant.name.toUpperCase()}`,
      '#ff5252',
      '30px',
    );
    this.cameras.main.shake(250, 0.006);
    playSfx(this, 'bossSpawn');
    // Swap to the intense boss soundtrack as the telegraph begins, so the music
    // ramps with the warning rather than after the boss materializes.
    enterBossMusic(this);
    // Swap the field to the hostile hell arena in lockstep with the boss music.
    this.enterBossBackground();
    this.showBossShadow(tier);
  }

  // Cross-fades the dark "hell arena" overlay in over the player's selected
  // background when a boss wave begins. The base background (this.bgImage) stays
  // underneath, so reverting is just fading this overlay back out. Idempotent and
  // re-entrant: entering while already active simply keeps the overlay shown.
  enterBossBackground() {
    this.bossBackgroundActive = true;
    const key = backgroundKey(BOSS_BACKGROUND.id);
    if (!this.bossBgImage) {
      this.bossBgImage = coverBackground(this, key).setDepth(-19).setAlpha(0);
    } else {
      coverBackground(this, key, this.bossBgImage).setVisible(true);
    }
    this.tweens.killTweensOf(this.bossBgImage);
    this.tweens.add({
      targets: this.bossBgImage,
      alpha: 1,
      duration: CFG.boss.transitionMs,
      ease: 'Sine.easeInOut',
    });
  }

  // Reverts to the player's selected background when the boss ends (death,
  // jumpToWave, player death mid-boss, or scene shutdown). Idempotent: safe to
  // call when no boss background is active. `immediate` skips the fade for
  // teardown paths where the scene is going away.
  exitBossBackground(immediate = false) {
    this.bossBackgroundActive = false;
    if (!this.bossBgImage) return;
    this.tweens.killTweensOf(this.bossBgImage);
    if (immediate) {
      this.bossBgImage.destroy();
      this.bossBgImage = null;
      return;
    }
    this.tweens.add({
      targets: this.bossBgImage,
      alpha: 0,
      duration: CFG.boss.transitionMs,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.bossBgImage?.destroy();
        this.bossBgImage = null;
      },
    });
  }

  // Telegraph the boss with a harmless shadow at its spawn spot, giving the
  // player time to move away before the boss materializes there.
  showBossShadow(tier) {
    this.bossSpawning = true;
    const x = this.arenaW / 2;
    const y = CFG.boss.anchorY;
    const shadow = this.add.circle(x, y, CFG.boss.radius, 0x000000, 0.45).setDepth(3.6);
    shadow.setStrokeStyle(3, 0x000000, 0.7);
    this.tweens.add({
      targets: shadow,
      alpha: { from: 0.15, to: 0.5 },
      scale: { from: 0.7, to: 1.05 },
      duration: 360,
      yoyo: true,
      repeat: -1,
    });
    this.bossShadow = shadow;
    this.bossShadowEvent = this.time.delayedCall(CFG.boss.shadowMs, () => {
      this.bossShadowEvent = null;
      this.clearBossShadow();
      if (this.gameOver) return;
      this.createBoss(tier);
    });
  }

  clearBossShadow() {
    this.bossSpawning = false;
    if (this.bossShadowEvent) {
      this.bossShadowEvent.remove(false);
      this.bossShadowEvent = null;
    }
    if (this.bossShadow) {
      this.bossShadow.destroy();
      this.bossShadow = null;
    }
  }

  // Variant archetype for a boss tier (clamped; tiers past the last repeat the
  // final boss, which keeps scaling up via the difficulty knobs).
  bossVariant(tier) {
    const v = CFG.boss.variants;
    return v[Phaser.Math.Clamp(tier - 1, 0, v.length - 1)];
  }

  // Attack cooldowns shrink as the boss tier rises (floored).
  bossCadence(tier) {
    return Math.max(CFG.boss.cadenceScaleMin, 1 - CFG.boss.cadenceScalePerTier * (tier - 1));
  }

  bossProjSpeed(base, tier) {
    return base + CFG.boss.projSpeedPerTier * (tier - 1);
  }

  bossPowerCooldown(boss, name) {
    return (
      CFG.boss.powers[name].cooldownMs *
      this.bossCadence(boss.tier) *
      CFG.boss.phaseCadenceScale[boss.phaseIndex]
    );
  }

  createBoss(tier) {
    const cfg = CFG.boss;
    const variant = this.bossVariant(tier);
    const x = this.arenaW / 2;
    const y = cfg.anchorY;
    const now = this.time.now;

    const hasSpriteArt = variant.id && BOSS_SPRITES[variant.id];
    const boss = hasSpriteArt
      ? this.add.sprite(x, y, BOSS_SPRITES[variant.id].idle_s.key)
      : this.add.circle(x, y, cfg.radius, variant.body);
    if (!hasSpriteArt) boss.setStrokeStyle(5, variant.accent, 0.95);
    boss.setDepth(4);
    this.physics.add.existing(boss);
    this.enemies.add(boss);
    boss.baseScale = hasSpriteArt ? 0.68 : 1;
    const bodyRadius = hasSpriteArt ? cfg.hitRadius / boss.baseScale : cfg.hitRadius;
    boss.body.setCircle(bodyRadius);
    const bodyCenter = hasSpriteArt ? 128 : cfg.radius;
    boss.body.setOffset(bodyCenter - bodyRadius, bodyCenter - bodyRadius);

    boss.type = 'boss';
    boss.tier = tier;
    boss.bossTier = tier; // kept for reward/back-compat
    boss.variant = variant;
    boss.wave = this.wave;
    boss.maxHp = cfg.baseHp + cfg.hpPerTier * (tier - 1);
    boss.hp = boss.maxHp;
    boss.maxShield = cfg.baseShield + cfg.shieldPerTier * (tier - 1);
    boss.shield = boss.maxShield;
    boss.shieldUp = true;
    boss.phaseIndex = 0;
    boss.phaseChangingUntil = now + cfg.introMs;
    boss.speed = 0;
    boss.spiralPhase = 0;
    boss.hasSpriteArt = Boolean(hasSpriteArt);
    boss.visualUntil = 0;
    boss.actionEvent = null;

    boss.core = this.add.circle(x, y, 18, variant.core, 0.95).setDepth(4.3);
    boss.core.setVisible(!hasSpriteArt);
    boss.shieldRingGfx = this.add.circle(x, y, cfg.hitRadius - 2).setDepth(4.1);
    boss.shieldRingGfx.setStrokeStyle(3, cfg.shieldColor, 0.85);
    boss.shieldRingGfx.setFillStyle(cfg.shieldColor, 0.08);
    boss.weakPoints = [];
    boss.telegraph = null;

    boss.powerNextAt = {};
    this.resetBossPowerTimers(boss, now + cfg.introMs);
    boss.chargeWindupUntil = 0;
    boss.chargeEndsAt = 0;
    boss.chargeDir = { x: 0, y: 0 };

    this.configureBossPhase(boss);
    this.boss = boss;
    this.showBossBar(boss);

    // Physics-safe entrance: scale + alpha in (position stays put).
    boss.setScale(boss.baseScale * 1.5);
    boss.setAlpha(0.2);
    boss.core.setAlpha(0.2);
    this.tweens.add({
      targets: [boss, boss.core],
      alpha: 1,
      duration: cfg.introMs,
      ease: 'Quad.out',
    });
    this.tweens.add({
      targets: boss,
      scale: boss.baseScale,
      duration: cfg.introMs,
      ease: 'Back.out',
    });

    return boss;
  }

  // Stagger each power's first/next cast so the boss doesn't unload everything
  // on the same frame. Only powers the variant uses ever fire (gated per phase).
  resetBossPowerTimers(boss, from) {
    const offsets = {
      summon: 800,
      barrage: 1500,
      spiral: 1200,
      aimedVolley: 1800,
      charge: 3000,
      nova: 2400,
      shieldSlam: 5000,
    };
    for (const name of Object.keys(CFG.boss.powers)) {
      boss.powerNextAt[name] = from + (offsets[name] || 1000);
    }
  }

  configureBossPhase(boss) {
    const want = boss.variant.weakPointsByPhase[boss.phaseIndex];
    while (boss.weakPoints.length < want) {
      const node = this.add
        .circle(boss.x, boss.y, CFG.boss.weakPoint.nodeRadius, CFG.boss.weakPoint.color)
        .setDepth(4.4);
      node.setStrokeStyle(2, 0xffffff, 0.9);
      boss.weakPoints.push(node);
    }
    while (boss.weakPoints.length > want) {
      boss.weakPoints.pop().destroy();
    }
  }

  updateBoss(boss, px, py, now) {
    this.positionBossParts(boss, now);
    this.keepEnemiesOutsideBoss(boss);
    this.updateBossBar(boss);
    this.updateBossSprite(boss, px, py, now);

    if (now < boss.phaseChangingUntil) {
      boss.body.setVelocity(0, 0);
      return;
    }

    const charge = CFG.boss.powers.charge;

    // Mid-charge: keep the launched velocity, do nothing else.
    if (now < boss.chargeEndsAt) return;
    if (boss.chargeEndsAt !== 0) {
      boss.chargeEndsAt = 0;
      this.bossSlam(boss);
      boss.powerNextAt.charge = now + this.bossPowerCooldown(boss, 'charge');
    }

    // Charge windup: stand still and telegraph, then launch.
    if (boss.chargeWindupUntil > 0) {
      boss.body.setVelocity(0, 0);
      this.drawBossTelegraph(boss, px, py);
      if (now >= boss.chargeWindupUntil) {
        boss.chargeWindupUntil = 0;
        if (boss.telegraph) {
          boss.telegraph.destroy();
          boss.telegraph = null;
        }
        const dx = px - boss.x;
        const dy = py - boss.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = this.bossProjSpeed(charge.speed, boss.tier);
        boss.chargeDir = { x: dx / len, y: dy / len };
        boss.body.setVelocity(boss.chargeDir.x * speed, boss.chargeDir.y * speed);
        boss.chargeEndsAt = now + charge.durationMs;
        if (boss.hasSpriteArt && BOSS_SPRITES[boss.variant.id]?.charge_release) {
          boss.visualUntil = boss.chargeEndsAt;
          this.setBossSpriteFrame(boss, 'charge_release');
        }
      }
      return;
    }

    // Drift toward the top, tracking the player horizontally.
    const moveSpeed =
      CFG.boss.phaseMoveSpeed[boss.phaseIndex] + CFG.boss.moveSpeedPerTier * (boss.tier - 1);
    const tx = Phaser.Math.Clamp(px, CFG.boss.edgeMargin, this.arenaW - CFG.boss.edgeMargin);
    const ty = CFG.boss.anchorY;
    const dx = tx - boss.x;
    const dy = ty - boss.y;
    const len = Math.hypot(dx, dy) || 1;
    if (len > 6) boss.body.setVelocity((dx / len) * moveSpeed, (dy / len) * moveSpeed);
    else boss.body.setVelocity(0, 0);

    // Do not consume another power's cooldown while an art telegraph is waiting
    // to release. It will remain ready and cast on a later update.
    if (boss.actionEvent) return;

    // Cast whichever powers this variant uses in the current phase.
    for (const name of boss.variant.phasePowers[boss.phaseIndex]) {
      if (now < (boss.powerNextAt[name] ?? 0)) continue;
      if (name === 'charge') {
        boss.chargeWindupUntil = now + charge.windupMs;
        if (boss.hasSpriteArt && BOSS_SPRITES[boss.variant.id]?.charge_telegraph) {
          boss.visualUntil = boss.chargeWindupUntil;
          this.setBossSpriteFrame(boss, 'charge_telegraph');
        }
        boss.powerNextAt.charge = now + this.bossPowerCooldown(boss, 'charge'); // reset on slam
        return;
      }
      if (name === 'shieldSlam') {
        if (boss.shieldUp) {
          boss.powerNextAt.shieldSlam = now + 1000; // retry soon once the shield is down
          continue;
        }
        this.bossShieldSlam(boss);
      } else {
        this.castBossPower(boss, name, now);
      }
      boss.powerNextAt[name] = now + this.bossPowerCooldown(boss, name);
    }
  }

  // Summoned minions must never sit inside the large boss body, where the
  // player's shots would hit the boss first and leave them unreachable. Push
  // any overlapping enemy out to the boss's edge each frame.
  keepEnemiesOutsideBoss(boss) {
    const minDist = CFG.boss.hitRadius + 16;
    this.enemies.getChildren().forEach((e) => {
      if (e === boss) return;
      const dx = e.x - boss.x;
      const dy = e.y - boss.y;
      const d = Math.hypot(dx, dy);
      if (d < minDist) {
        const a = d < 1 ? Math.random() * Math.PI * 2 : Math.atan2(dy, dx);
        e.x = boss.x + Math.cos(a) * minDist;
        e.y = boss.y + Math.sin(a) * minDist;
      }
    });
  }

  castBossPower(boss, name, now) {
    const frames = BOSS_SPRITES[boss.variant.id];
    if (frames?.[`${name}_telegraph`] && frames?.[`${name}_release`]) {
      return this.playBossPowerArt(boss, name, now);
    }
    return this.executeBossPower(boss, name, now);
  }

  executeBossPower(boss, name, now) {
    if (name === 'summon') return this.bossSummon(boss);
    if (name === 'barrage') return this.bossBarrage(boss, now);
    if (name === 'spiral') return this.bossSpiral(boss, now);
    if (name === 'aimedVolley') return this.bossAimedVolley(boss, now);
    if (name === 'nova') return this.bossNova(boss);
    if (name === 'beamSweep') return this.bossBeamSweep(boss, now);
    if (name === 'mirrorClones') return this.bossMirrorClones(boss, now);
    if (name === 'gravityWell') return this.bossGravityWell(boss);
    if (name === 'dotField') return this.bossDotField();
    if (name === 'missiles') return this.bossMissiles(boss, now);
  }

  positionBossParts(boss, now) {
    boss.core.setPosition(boss.x, boss.y);
    boss.shieldRingGfx.setPosition(boss.x, boss.y);
    boss.shieldRingGfx.setVisible(boss.shieldUp);
    const wp = CFG.boss.weakPoint;
    const orbitSpeed =
      CFG.boss.phaseOrbitSpeed[boss.phaseIndex] + CFG.boss.orbitSpeedPerTier * (boss.tier - 1);
    const baseAngle = (now / 1000) * orbitSpeed * (Math.PI / 180);
    const n = Math.max(1, boss.weakPoints.length);
    boss.weakPoints.forEach((node, i) => {
      const a = baseAngle + (i / n) * Math.PI * 2;
      node.setPosition(
        boss.x + Math.cos(a) * wp.orbitRadius,
        boss.y + Math.sin(a) * wp.orbitRadius,
      );
    });
  }

  setBossSpriteFrame(boss, frame) {
    const sprite = BOSS_SPRITES[boss.variant.id]?.[frame];
    if (boss.active && sprite && boss.texture.key !== sprite.key) boss.setTexture(sprite.key);
  }

  bossFacing(dx, dy) {
    const horizontal = dx > 8 ? 'e' : dx < -8 ? 'w' : '';
    const vertical = dy > 8 ? 's' : dy < -8 ? 'n' : '';
    return `${vertical}${horizontal}` || 's';
  }

  updateBossSprite(boss, px, py, now) {
    if (!boss.hasSpriteArt || now < boss.visualUntil) return;
    if (boss.phaseIndex === 2) {
      this.setBossSpriteFrame(boss, 'enrage');
      return;
    }

    const moving = boss.body.speed > 4;
    const dx = moving ? boss.body.velocity.x : px - boss.x;
    const dy = moving ? boss.body.velocity.y : py - boss.y;
    const facing = this.bossFacing(dx, dy);
    if (moving && facing === 's') {
      this.setBossSpriteFrame(boss, `walk_s_${Math.floor(now / 180) % 4}`);
      return;
    }
    this.setBossSpriteFrame(boss, `idle_${facing}`);
  }

  playBossPowerArt(boss, name, now) {
    const telegraphMs = 260;
    const releaseMs = 220;
    boss.visualUntil = now + telegraphMs + releaseMs;
    this.setBossSpriteFrame(boss, `${name}_telegraph`);
    boss.actionEvent = this.time.delayedCall(telegraphMs, () => {
      boss.actionEvent = null;
      if (!boss.active || this.gameOver) return;
      this.setBossSpriteFrame(boss, `${name}_release`);
      this.executeBossPower(boss, name, this.time.now);
    });
  }

  cancelBossAction(boss) {
    if (!boss?.actionEvent) return;
    boss.actionEvent.remove(false);
    boss.actionEvent = null;
  }

  damageBoss(boss, sourceX, sourceY, amount) {
    const wp = CFG.boss.weakPoint;
    let hitWeak = false;
    for (const node of boss.weakPoints) {
      if (Phaser.Math.Distance.Between(sourceX, sourceY, node.x, node.y) <= wp.hitRadius) {
        hitWeak = true;
        break;
      }
    }

    if (hitWeak) {
      boss.hp -= amount * wp.damageMult;
      this.bossHitFx(sourceX, sourceY, wp.color);
      playSfx(this, 'bossHit');
    } else if (boss.shieldUp) {
      boss.shield -= amount;
      this.bossHitFx(sourceX, sourceY, CFG.boss.shieldColor);
      if (boss.shield <= 0) {
        boss.shield = 0;
        boss.shieldUp = false;
        this.bossShieldShatter(boss);
      }
      this.updateBossBar(boss);
      return amount;
    } else {
      boss.hp -= amount;
      this.bossHitFx(sourceX, sourceY, boss.variant.core);
    }

    if (boss.hp <= 0) {
      boss.hp = 0;
      this.killBoss(boss);
      return amount;
    }
    this.bossTryPhaseChange(boss);
    this.updateBossBar(boss);
    return amount;
  }

  bossTryPhaseChange(boss) {
    const frac = boss.hp / boss.maxHp;
    const [t2, t3] = CFG.boss.phaseThresholds;
    let target = 0;
    if (frac <= t3) target = 2;
    else if (frac <= t2) target = 1;
    if (target <= boss.phaseIndex) return;

    boss.phaseIndex = target;
    playSfx(this, 'bossPhase');
    const now = this.time.now;
    boss.phaseChangingUntil = now + CFG.boss.transitionMs;
    boss.shield = boss.maxShield;
    boss.shieldUp = true;
    this.configureBossPhase(boss);
    boss.chargeWindupUntil = 0;
    boss.chargeEndsAt = 0;
    this.cancelBossAction(boss);
    if (boss.telegraph) {
      boss.telegraph.destroy();
      boss.telegraph = null;
    }
    this.resetBossPowerTimers(boss, now + CFG.boss.transitionMs);
    if (boss.hasSpriteArt && target === 2) {
      boss.visualUntil = now + CFG.boss.transitionMs;
      this.setBossSpriteFrame(boss, 'enrage');
    }
    this.cameras.main.flash(220, 120, 30, 160);
    this.cameras.main.shake(220, 0.006);
  }

  // Enemy types the boss may summon: only kinds that have already appeared in
  // earlier waves (appearFromWave strictly below the boss's own wave). So a
  // wave-20 boss can summon wave-1..19 enemies, but nothing from wave 20+.
  bossSummonPool(wave) {
    const candidates = [
      'swarmer',
      'tank',
      'firecaster',
      'splitter',
      'bomber',
      'slime',
      'teleporter',
      'shielded',
      'sniper',
      'dasher',
    ];
    const pool = candidates.filter((t) => (CFG[t]?.appearFromWave ?? 1) < wave);
    return pool.length ? pool : ['swarmer'];
  }

  bossSummon(boss) {
    const p = CFG.boss.powers.summon;
    const pool = this.bossSummonPool(boss.wave);
    const adds = this.enemies.getChildren().filter((e) => e !== boss).length;
    const room = Math.max(0, p.maxAdds - adds);
    const want = p.count + Math.floor((boss.tier - 1) / 3); // a few more at higher tiers
    const toSpawn = Math.min(want, room);
    for (let i = 0; i < toSpawn; i++) {
      const type = pool[Math.floor(Math.random() * pool.length)];
      const a = Math.random() * Math.PI * 2;
      const dist = CFG.boss.hitRadius + 20 + Math.random() * 40; // spawn outside the boss body
      const x = Phaser.Math.Clamp(boss.x + Math.cos(a) * dist, 40, this.arenaW - 40);
      const y = Phaser.Math.Clamp(boss.y + Math.sin(a) * dist, 40, this.arenaH - 40);
      this.createEnemyByType(type, x, y);
    }
    const flash = this.add.circle(boss.x, boss.y, CFG.boss.radius + 20, p.glow, 0.18).setDepth(3.5);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.4,
      duration: 360,
      onComplete: () => flash.destroy(),
    });
  }

  // Full-circle radial spread. Bullet count and speed grow with tier.
  bossBarrage(boss, now) {
    const p = CFG.boss.powers.barrage;
    const count = p.count + (boss.tier - 1);
    const speed = this.bossProjSpeed(p.speed, boss.tier);
    const baseAngle = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const a = baseAngle + (i / count) * Math.PI * 2;
      this.fireEnemyShot(
        boss,
        Math.cos(a),
        Math.sin(a),
        now,
        p.radius,
        boss.variant.proj,
        0xffffff,
        speed,
        p.lifetimeMs,
        p.damage,
      );
    }
    this.bossMuzzleFlash(boss, boss.variant.proj);
  }

  // Rotating arms: each cast steps the emission angle, so repeated casts trace a
  // spiral the player must weave through.
  bossSpiral(boss, now) {
    const p = CFG.boss.powers.spiral;
    boss.spiralPhase += p.stepDeg * (Math.PI / 180);
    const speed = this.bossProjSpeed(p.speed, boss.tier);
    for (let i = 0; i < p.count; i++) {
      const a = boss.spiralPhase + (i / p.count) * Math.PI * 2;
      this.fireEnemyShot(
        boss,
        Math.cos(a),
        Math.sin(a),
        now,
        p.radius,
        boss.variant.accent,
        boss.variant.proj,
        speed,
        p.lifetimeMs,
        p.damage,
      );
    }
    this.bossMuzzleFlash(boss, boss.variant.accent);
  }

  // Tight fan of fast shots aimed at the player's current position.
  bossAimedVolley(boss, now) {
    const p = CFG.boss.powers.aimedVolley;
    const aim = Math.atan2(this.player.sprite.y - boss.y, this.player.sprite.x - boss.x);
    const speed = this.bossProjSpeed(p.speed, boss.tier);
    const spread = p.spreadDeg * (Math.PI / 180);
    for (let i = 0; i < p.count; i++) {
      const t = p.count > 1 ? i / (p.count - 1) - 0.5 : 0;
      const a = aim + t * spread;
      this.fireEnemyShot(
        boss,
        Math.cos(a),
        Math.sin(a),
        now,
        p.radius,
        boss.variant.core,
        0xfff8e1,
        speed,
        p.lifetimeMs,
        p.damage,
      );
    }
    this.bossMuzzleFlash(boss, boss.variant.core);
  }

  // Telegraphed area-denial blast centred on the boss: an expanding outline,
  // then a damaging shockwave after a short windup.
  bossNova(boss) {
    const p = CFG.boss.powers.nova;
    const cx = boss.x;
    const cy = boss.y;
    const tele = this.add
      .circle(cx, cy, p.radius, 0xff5252, 0.06)
      .setStrokeStyle(3, 0xff5252, 0.6)
      .setDepth(4.15);
    this.tweens.add({ targets: tele, scale: { from: 0.2, to: 1 }, duration: p.windupMs });
    this.time.delayedCall(p.windupMs, () => {
      tele.destroy();
      if (this.gameOver) return;
      const burst = this.add.circle(cx, cy, p.radius, 0xff5252, 0.22).setDepth(4.2);
      this.tweens.add({
        targets: burst,
        alpha: 0,
        scale: 1.15,
        duration: 260,
        onComplete: () => burst.destroy(),
      });
      const d = Phaser.Math.Distance.Between(cx, cy, this.player.sprite.x, this.player.sprite.y);
      if (d <= p.radius) this.damagePlayer(p.damage);
      this.cameras.main.shake(120, 0.006);
    });
  }

  // Timed boss attacks register here and are ticked each frame until done.
  updateBossEffects(time) {
    if (!this.bossEffects.length) return;
    this.bossEffects = this.bossEffects.filter((eff) => {
      const done = eff.tick(time);
      if (done) eff.destroy?.();
      return !done;
    });
  }

  clearBossEffects() {
    for (const eff of this.bossEffects) eff.destroy?.();
    this.bossEffects = [];
  }

  // Hexweaver phase 1: long beams that rotate around the boss; standing in one hurts.
  bossBeamSweep(boss, now) {
    const p = CFG.boss.powers.beamSweep;
    const gfx = this.add.graphics().setDepth(3.9);
    const start = now;
    // Aim the gaps at the player, not a beam. The beams are evenly spaced by
    // `step`, so place the player's current direction exactly between two beams
    // at spawn. The sweep still rotates toward them, but never starts on top of
    // them — they get a fair chance to move out of the way.
    const step = (Math.PI * 2) / p.beams;
    const angToPlayer = Math.atan2(this.player.sprite.y - boss.y, this.player.sprite.x - boss.x);
    const startAngle = angToPlayer + step / 2;
    const sweepRad = p.sweepDegPerSec * (Math.PI / 180);
    const len = this.arenaW + this.arenaH;
    this.bossEffects.push({
      tick: (t) => {
        if (!boss.active || t - start >= p.durationMs) return true;
        const b = boss;
        const ang = startAngle + ((t - start) / 1000) * sweepRad;
        const px = this.player.sprite.x;
        const py = this.player.sprite.y;
        gfx.clear();
        for (let k = 0; k < p.beams; k++) {
          const a = ang + (k / p.beams) * Math.PI * 2;
          const ex = b.x + Math.cos(a) * len;
          const ey = b.y + Math.sin(a) * len;
          gfx.lineStyle(4, b.variant.accent, 0.85);
          gfx.lineBetween(b.x, b.y, ex, ey);
          if (this.pointToSegmentDistance(px, py, b.x, b.y, ex, ey) <= p.hitWidth) {
            this.damagePlayer(p.damage);
          }
        }
        return false;
      },
      destroy: () => gfx.destroy(),
    });
  }

  // Hexweaver phase 3: a vortex that drags the player toward its damaging core
  // for a few seconds; the player can fight the pull. It spawns away from the
  // player (never on top of them) and shows a harmless gray warning for a second
  // before it turns active and starts pulling/damaging.
  bossGravityWell(boss) {
    const p = CFG.boss.powers.gravityWell;
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const margin = p.radius * 0.5;
    const angle = Math.random() * Math.PI * 2;
    const cx = Phaser.Math.Clamp(px + Math.cos(angle) * p.spawnDist, margin, this.arenaW - margin);
    const cy = Phaser.Math.Clamp(py + Math.sin(angle) * p.spawnDist, margin, this.arenaH - margin);
    // Telegraph: gray, harmless ring + core that cannot hit the player yet.
    const ring = this.add
      .circle(cx, cy, p.radius, 0x9e9e9e, 0.1)
      .setStrokeStyle(3, 0xcfcfcf, 0.7)
      .setDepth(3.7);
    const core = this.add.circle(cx, cy, 16, 0xbdbdbd, 0.5).setDepth(3.75);
    this.time.delayedCall(p.telegraphMs, () => {
      if (!this.bossActive) {
        ring.destroy();
        core.destroy();
        return;
      }
      // Switch to the live colours, then begin pulling and damaging.
      ring.setFillStyle(boss.variant.accent, 0.12);
      ring.setStrokeStyle(3, boss.variant.accent, 0.7);
      core.setFillStyle(boss.variant.core, 0.55);
      const start = this.time.now;
      this.bossEffects.push({
        tick: (t) => {
          if (!this.bossActive || t - start >= p.durationMs) return true;
          core.rotation += 0.2;
          const ppx = this.player.sprite.x;
          const ppy = this.player.sprite.y;
          const dx = cx - ppx;
          const dy = cy - ppy;
          const d = Math.hypot(dx, dy) || 1;
          this.player.sprite.body.velocity.x += (dx / d) * p.pullSpeed;
          this.player.sprite.body.velocity.y += (dy / d) * p.pullSpeed;
          if (d <= p.damageRadius) this.damagePlayer(p.damage);
          return false;
        },
        destroy: () => {
          ring.destroy();
          core.destroy();
        },
      });
    });
  }

  // Phantom phase 3: 4 dots in a square around the player. They warn (transparent)
  // then flash red and damage for a short window.
  bossDotField() {
    const p = CFG.boss.powers.dotField;
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const offsets = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ];
    for (const [ox, oy] of offsets) {
      const x = Phaser.Math.Clamp(px + ox * p.spread, 30, this.arenaW - 30);
      const y = Phaser.Math.Clamp(py + oy * p.spread, 30, this.arenaH - 30);
      this.spawnDot(x, y);
    }
  }

  spawnDot(x, y) {
    const p = CFG.boss.powers.dotField;
    const dot = this.add
      .circle(x, y, p.radius, 0xff1744, 0.12)
      .setStrokeStyle(2, 0xff1744, 0.45)
      .setDepth(3.7);
    this.time.delayedCall(p.telegraphMs, () => {
      if (!this.bossActive) {
        dot.destroy();
        return;
      }
      dot.setFillStyle(0xff1744, 0.6);
      dot.setStrokeStyle(2, 0xff5252, 0.95);
      const start = this.time.now;
      this.bossEffects.push({
        tick: (t) => {
          if (!this.bossActive || t - start >= p.activeMs) return true;
          const d = Phaser.Math.Distance.Between(x, y, this.player.sprite.x, this.player.sprite.y);
          if (d <= p.radius) this.damagePlayer(p.damage);
          return false;
        },
        destroy: () => dot.destroy(),
      });
    });
  }

  // Hexweaver phase 2: illusory clones that fire and vanish when shot or after a
  // few seconds. Only the real boss takes HP damage.
  bossMirrorClones(boss, now) {
    const p = CFG.boss.powers.mirrorClones;
    for (let i = 0; i < p.count; i++) {
      const a = (i / p.count) * Math.PI * 2 + Math.random();
      const dist = CFG.boss.hitRadius + 40;
      const x = Phaser.Math.Clamp(boss.x + Math.cos(a) * dist, 60, this.arenaW - 60);
      const y = Phaser.Math.Clamp(boss.y + Math.sin(a) * dist, 60, this.arenaH - 60);
      this.createDecoy(x, y, boss, now);
    }
    this.bossMuzzleFlash(boss, boss.variant.accent);
  }

  createDecoy(x, y, boss, now) {
    const p = CFG.boss.powers.mirrorClones;
    const decoy = this.add
      .sprite(x, y, RUNE_PROWLER_SPRITES.s.key)
      .setScale(RUNE_PROWLER_SCALE)
      .setDepth(4);
    this.physics.add.existing(decoy);
    this.enemies.add(decoy);
    const sourceRadius = p.radius / RUNE_PROWLER_SCALE;
    decoy.body.setCircle(sourceRadius);
    decoy.body.setOffset(128 - sourceRadius, 128 - sourceRadius);
    decoy.type = 'decoy';
    decoy.hp = 1;
    decoy.maxHp = 1;
    decoy.speed = 70;
    decoy.proj = boss.variant.proj;
    decoy.expiresAt = now + p.lifetimeMs;
    decoy.nextFireAt = now + p.fireCooldownMs;
    decoy.pulseTween = this.tweens.add({
      targets: decoy,
      alpha: { from: 0.5, to: 0.95 },
      yoyo: true,
      repeat: -1,
      duration: 500,
    });
  }

  updateDecoy(decoy, px, py, now) {
    if (now >= decoy.expiresAt) {
      this.cleanupEnemyExtras(decoy);
      decoy.destroy();
      this.maybeStartNextWave();
      return;
    }
    this.keepRange(decoy, px, py, 150, 260, decoy.speed);
    const facing = this.bossFacing(px - decoy.x, py - decoy.y);
    const frame = RUNE_PROWLER_SPRITES[facing] ?? RUNE_PROWLER_SPRITES.s;
    if (decoy.texture.key !== frame.key) decoy.setTexture(frame.key);
    if (now >= decoy.nextFireAt) {
      decoy.nextFireAt = now + CFG.boss.powers.mirrorClones.fireCooldownMs;
      const aim = Math.atan2(py - decoy.y, px - decoy.x);
      this.fireEnemyShot(
        decoy,
        Math.cos(aim),
        Math.sin(aim),
        now,
        6,
        decoy.proj,
        0xffffff,
        230,
        2600,
        1,
      );
    }
  }

  // Overlord: homing missiles with a capped turn rate (out-maneuverable), each
  // destroyed by a single shot.
  bossMissiles(boss, now) {
    const p = CFG.boss.powers.missiles;
    const baseAngle = Math.atan2(this.player.sprite.y - boss.y, this.player.sprite.x - boss.x);
    for (let i = 0; i < p.count; i++) {
      const spread = ((i - (p.count - 1) / 2) * 40 * Math.PI) / 180;
      this.createMissile(boss, baseAngle + spread, now);
    }
    this.bossMuzzleFlash(boss, boss.variant.core);
  }

  createMissile(boss, angle, now) {
    const p = CFG.boss.powers.missiles;
    const x = boss.x + Math.cos(angle) * (CFG.boss.hitRadius + 8);
    const y = boss.y + Math.sin(angle) * (CFG.boss.hitRadius + 8);
    const missile = this.add.circle(x, y, p.radius, boss.variant.core);
    missile.setStrokeStyle(2, 0xffffff, 0.9).setDepth(4);
    this.physics.add.existing(missile);
    this.enemies.add(missile);
    missile.body.setCircle(p.radius);
    missile.body.setOffset(-p.radius, -p.radius);
    missile.type = 'missile';
    missile.hp = 1;
    missile.maxHp = 1;
    missile.angle2 = angle;
    missile.expiresAt = now + p.lifetimeMs;
    missile.body.setVelocity(Math.cos(angle) * p.speed, Math.sin(angle) * p.speed);
  }

  updateMissile(missile, px, py, now) {
    if (now >= missile.expiresAt) {
      missile.destroy();
      this.maybeStartNextWave();
      return;
    }
    const p = CFG.boss.powers.missiles;
    const dt = this.game.loop.delta / 1000;
    const desired = Math.atan2(py - missile.y, px - missile.x);
    const maxStep = p.turnDegPerSec * (Math.PI / 180) * dt;
    const diff = Phaser.Math.Angle.Wrap(desired - missile.angle2);
    missile.angle2 += Phaser.Math.Clamp(diff, -maxStep, maxStep);
    missile.body.setVelocity(
      Math.cos(missile.angle2) * p.speed,
      Math.sin(missile.angle2) * p.speed,
    );
    missile.rotation = missile.angle2;
  }

  bossMuzzleFlash(boss, color) {
    const flash = this.add.circle(boss.x, boss.y, CFG.boss.radius, color, 0.22).setDepth(4.2);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.3,
      duration: 240,
      onComplete: () => flash.destroy(),
    });
  }

  drawBossTelegraph(boss, px, py) {
    if (!boss.telegraph) boss.telegraph = this.add.graphics().setDepth(3.8);
    const dx = px - boss.x;
    const dy = py - boss.y;
    const len = Math.hypot(dx, dy) || 1;
    boss.telegraph.clear();
    boss.telegraph.lineStyle(3, 0xff1744, 0.6);
    boss.telegraph.lineBetween(
      boss.x,
      boss.y,
      boss.x + (dx / len) * 900,
      boss.y + (dy / len) * 900,
    );
  }

  bossSlam(boss) {
    const charge = CFG.boss.powers.charge;
    const r = charge.slamRadius;
    const ring = this.add.circle(boss.x, boss.y, r, CFG.boss.shieldColor, 0.22).setDepth(4.2);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.3,
      duration: 300,
      onComplete: () => ring.destroy(),
    });
    const d = Phaser.Math.Distance.Between(
      boss.x,
      boss.y,
      this.player.sprite.x,
      this.player.sprite.y,
    );
    if (d <= r) this.damagePlayer(charge.slamDamage);
    this.cameras.main.shake(150, 0.008);
  }

  bossShieldSlam(boss) {
    boss.shield = boss.maxShield;
    boss.shieldUp = true;
    const ring = this.add
      .circle(boss.x, boss.y, CFG.boss.hitRadius + 10)
      .setStrokeStyle(4, CFG.boss.shieldColor, 0.9)
      .setDepth(4.2);
    this.tweens.add({
      targets: ring,
      scale: { from: 1.4, to: 1 },
      alpha: { from: 1, to: 0 },
      duration: 300,
      onComplete: () => ring.destroy(),
    });
    this.updateBossBar(boss);
  }

  bossShieldShatter(boss) {
    const ring = this.add
      .circle(boss.x, boss.y, CFG.boss.hitRadius)
      .setStrokeStyle(4, CFG.boss.shieldColor, 0.9)
      .setDepth(4.2);
    this.tweens.add({
      targets: ring,
      scale: { from: 1, to: 1.5 },
      alpha: { from: 1, to: 0 },
      duration: 300,
      onComplete: () => ring.destroy(),
    });
    this.cameras.main.shake(120, 0.004);
    this.updateBossBar(boss);
  }

  bossHitFx(x, y, color) {
    const spark = this.add.circle(x, y, 5, color, 0.9).setDepth(4.6);
    this.tweens.add({
      targets: spark,
      alpha: 0,
      scale: 1.8,
      duration: 160,
      onComplete: () => spark.destroy(),
    });
  }

  bossDeathBurst(x, y) {
    const accent = this.boss?.variant?.core ?? 0xff5252;
    for (let i = 0; i < 3; i++) {
      const ring = this.add
        .circle(x, y, 30 + i * 24, i % 2 ? CFG.boss.shieldColor : accent, 0.3)
        .setDepth(4.5);
      this.tweens.add({
        targets: ring,
        alpha: 0,
        scale: 2.2,
        duration: 520 + i * 120,
        ease: 'Quad.out',
        onComplete: () => ring.destroy(),
      });
    }
    this.cameras.main.shake(300, 0.01);
  }

  killBoss(boss) {
    const ex = boss.x;
    const ey = boss.y;
    this.playBossDeathAnimation(boss);
    this.cleanupEnemyExtras(boss);
    boss.destroy();
    // The boss kill is the one climactic beat that earns a bullet-time slow-mo.
    this.triggerSlowMo();
    this.onEnemyKilled('boss', ex, ey);
  }

  playBossDeathAnimation(boss) {
    const spriteFrames = BOSS_SPRITES[boss.variant.id];
    if (!spriteFrames?.death_0) return;
    const death = this.add
      .sprite(boss.x, boss.y, spriteFrames.death_0.key)
      .setScale(boss.baseScale)
      .setDepth(4.55);
    const sequence = ['death_1', 'death_2', 'death_3'];
    sequence.forEach((frame, index) => {
      this.time.delayedCall((index + 1) * 130, () => {
        if (death.active) death.setTexture(spriteFrames[frame].key);
      });
    });
    this.time.delayedCall((sequence.length + 1) * 130, () => death.destroy());
  }

  clearBossAdds() {
    this.enemies
      .getChildren()
      .slice()
      .forEach((e) => {
        this.cleanupEnemyExtras(e);
        e.destroy();
      });
  }

  payBossReward(x, y) {
    const tier = this.boss?.bossTier || 1;
    const r = CFG.boss.reward;
    const value = r.baseCoins + r.coinsPerTier * (tier - 1);
    // Drop the reward as one big coin the player must collect (not auto-credited).
    this.spawnBigCoin(x, y, value);
    this.showFloatingText(x, y - 30, 'BOSS DOWN', '#ffd54f');
  }

  showBossBar(boss) {
    this.bossName.setText(`${boss.variant.name.toUpperCase()}  ·  LV ${boss.bossTier}`);
    this.bossBarBg.setVisible(true);
    this.bossHpFill.setVisible(true);
    this.bossShieldFill.setVisible(true);
    this.bossName.setVisible(true);
    this.bossPips.setVisible(true);
    this.updateBossBar(boss);
  }

  updateBossBar(boss) {
    if (!this.bossBarBg.visible) return;
    const hpFrac = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
    const shieldFrac = Phaser.Math.Clamp(boss.shield / boss.maxShield, 0, 1);
    this.bossHpFill.scaleX = hpFrac;
    this.bossShieldFill.scaleX = shieldFrac;
    this.bossShieldFill.setVisible(boss.shieldUp && shieldFrac > 0);
    this.bossPips.setText(`PHASE ${boss.phaseIndex + 1}/3`);
  }

  hideBossBar() {
    this.bossBarBg.setVisible(false);
    this.bossHpFill.setVisible(false);
    this.bossShieldFill.setVisible(false);
    this.bossName.setVisible(false);
    this.bossPips.setVisible(false);
  }

  teardownBossState() {
    // Resolve back to normal music on every boss-end path (boss death, jumpToWave).
    exitBossMusic(this);
    // Cross-fade the field back to the player's selected background in lockstep.
    this.exitBossBackground();
    this.clearBossShadow();
    this.clearBossEffects();
    this.boss = null;
    this.bossActive = false;
    this.hideBossBar();
  }

  updateEnemies() {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const now = this.time.now;
    this.enemies.getChildren().forEach((enemy) => {
      if (enemy.type === 'boss') {
        this.updateBoss(enemy, px, py, now);
        return;
      }
      if (enemy.type === 'missile') {
        this.updateMissile(enemy, px, py, now);
        return;
      }
      if (enemy.type === 'decoy') {
        this.updateDecoy(enemy, px, py, now);
        return;
      }
      enemy.setFlipX(px < enemy.x);
      if (enemy.type === 'dasher') {
        this.updateDasher(enemy, px, py, now);
      } else if (enemy.type === 'firecaster') {
        this.updateFirecaster(enemy, px, py, now);
      } else if (enemy.type === 'bomber') {
        this.updateBomber(enemy, px, py, now);
      } else if (enemy.type === 'healer') {
        this.updateHealer(enemy, px, py, now);
      } else if (enemy.type === 'summoner') {
        this.updateSummoner(enemy, px, py, now);
      } else if (enemy.type === 'shielded') {
        this.updateShielded(enemy, px, py);
      } else if (enemy.type === 'teleporter') {
        this.updateTeleporter(enemy, px, py, now);
      } else if (enemy.type === 'sniper') {
        this.updateSniper(enemy, px, py, now);
      } else if (enemy.type === 'egg') {
        this.updateEgg(enemy, now);
      } else if (enemy.type === 'slime') {
        this.updateSlime(enemy, px, py, now);
      } else {
        this.chasePlayer(enemy, px, py, enemy.speed);
      }
    });
  }

  chasePlayer(enemy, px, py, speed) {
    const dx = px - enemy.x;
    const dy = py - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    enemy.body.setVelocity((dx / len) * speed, (dy / len) * speed);
    return { dx, dy, len, nx: dx / len, ny: dy / len };
  }

  updateDasher(enemy, px, py, now) {
    if (enemy.dashEndsAt > now) {
      return;
    }
    if (enemy.dashEndsAt !== 0) {
      enemy.dashEndsAt = 0;
      enemy.nextDashAt =
        now + Phaser.Math.Between(CFG.dasher.dashCooldownMinMs, CFG.dasher.dashCooldownMaxMs);
    }
    if (enemy.windupEndsAt > 0) {
      enemy.body.setVelocity(0, 0);
      const flashOn = Math.floor((enemy.windupEndsAt - now) / CFG.dasher.windupFlashMs) % 2 === 0;
      enemy.setTint(flashOn ? 0xffffff : enemy.baseTint);
      if (now >= enemy.windupEndsAt) {
        enemy.windupEndsAt = 0;
        enemy.setTint(enemy.baseTint);
        const dx = px - enemy.x;
        const dy = py - enemy.y;
        const len = Math.hypot(dx, dy) || 1;
        enemy.body.setVelocity(
          (dx / len) * CFG.dasher.dashSpeed,
          (dy / len) * CFG.dasher.dashSpeed,
        );
        enemy.dashEndsAt = now + CFG.dasher.dashDurationMs;
      }
      return;
    }
    if (now >= enemy.nextDashAt) {
      enemy.windupEndsAt = now + CFG.dasher.windupMs;
      enemy.body.setVelocity(0, 0);
      return;
    }
    const dx = px - enemy.x;
    const dy = py - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    enemy.body.setVelocity((dx / len) * enemy.speed, (dy / len) * enemy.speed);
  }

  updateFirecaster(enemy, px, py, now) {
    const dx = px - enemy.x;
    const dy = py - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;

    if (enemy.windupEndsAt > 0) {
      enemy.body.setVelocity(0, 0);
      const flashOn =
        Math.floor((enemy.windupEndsAt - now) / CFG.firecaster.windupFlashMs) % 2 === 0;
      enemy.setTint(flashOn ? 0xfff176 : 0xff7043);
      if (now >= enemy.windupEndsAt) {
        enemy.windupEndsAt = 0;
        enemy.clearTint();
        this.fireEnemyFireball(enemy, nx, ny, now);
        enemy.nextFireAt =
          now +
          Phaser.Math.Between(CFG.firecaster.fireCooldownMinMs, CFG.firecaster.fireCooldownMaxMs);
      }
      return;
    }

    if (now >= enemy.nextFireAt && len <= CFG.firecaster.maxRange + 80) {
      enemy.windupEndsAt = now + CFG.firecaster.windupMs;
      enemy.body.setVelocity(0, 0);
      return;
    }

    let moveX = 0;
    let moveY = 0;
    if (len > CFG.firecaster.maxRange) {
      moveX += nx * enemy.speed;
      moveY += ny * enemy.speed;
    } else if (len < CFG.firecaster.minRange) {
      moveX -= nx * enemy.speed;
      moveY -= ny * enemy.speed;
    } else {
      moveX += -ny * CFG.firecaster.strafeSpeed * enemy.strafeDir;
      moveY += nx * CFG.firecaster.strafeSpeed * enemy.strafeDir;
      if (Math.random() < 0.004) enemy.strafeDir *= -1;
    }
    enemy.body.setVelocity(moveX, moveY);
  }

  updateBomber(enemy, px, py, now) {
    const { len } = this.chasePlayer(enemy, px, py, enemy.speed);
    if (!enemy.explodingAt && len <= CFG.bomber.triggerRadius) {
      enemy.explodingAt = now + CFG.bomber.windupMs;
      enemy.body.setVelocity(0, 0);
    }
    if (enemy.explodingAt) {
      enemy.body.setVelocity(0, 0);
      const flashOn = Math.floor((enemy.explodingAt - now) / CFG.bomber.flashMs) % 2 === 0;
      enemy.setTint(flashOn ? 0xfff176 : 0xff5252);
      if (now >= enemy.explodingAt) {
        this.explodeEnemy(enemy.x, enemy.y, CFG.bomber.explosionRadius, true, enemy);
        enemy.destroy();
        this.maybeStartNextWave();
      }
    }
  }

  updateHealer(enemy, px, py, now) {
    this.keepRange(enemy, px, py, CFG.healer.minRange, CFG.healer.minRange + 90, enemy.speed);
    if (now < enemy.nextHealAt) return;
    enemy.nextHealAt = now + CFG.healer.healCooldownMs;
    let healed = false;
    this.enemies.getChildren().forEach((target) => {
      if (target === enemy || target.type === 'boss' || target.hp >= target.maxHp) return;
      const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, target.x, target.y);
      if (d <= CFG.healer.healRadius) {
        target.hp = Math.min(target.maxHp, target.hp + CFG.healer.healAmount);
        target.setTint(0x69f0ae);
        this.time.delayedCall(140, () => {
          if (target.active && target.type !== 'dasher') target.clearTint();
        });
        healed = true;
      }
    });
    if (healed) {
      const ring = this.add
        .circle(enemy.x, enemy.y, CFG.healer.healRadius, 0x69f0ae, 0.12)
        .setDepth(3.5);
      this.tweens.add({
        targets: ring,
        alpha: 0,
        scale: 1.1,
        duration: 300,
        onComplete: () => ring.destroy(),
      });
    }
  }

  updateSummoner(enemy, px, py, now) {
    this.keepRange(enemy, px, py, CFG.summoner.minRange, CFG.summoner.minRange + 110, enemy.speed);
    if (now < enemy.nextSummonAt) return;
    enemy.nextSummonAt = now + CFG.summoner.summonCooldownMs;
    // Don't pile up minions: only top up to maxMinionsAlive splitter-children.
    const room = Math.max(
      0,
      CFG.summoner.maxMinionsAlive - this.countEnemiesByType('splitter-child'),
    );
    const toSummon = Math.min(CFG.summoner.summonCount, room);
    if (toSummon <= 0) return;
    for (let i = 0; i < toSummon; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.createSplitterChild(enemy.x + Math.cos(angle) * 26, enemy.y + Math.sin(angle) * 26);
    }
    const flash = this.add.circle(enemy.x, enemy.y, 44, 0xab47bc, 0.18).setDepth(3.5);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.35,
      duration: 360,
      onComplete: () => flash.destroy(),
    });
  }

  updateShielded(enemy, px, py) {
    const { dx, dy, len } = this.chasePlayer(enemy, px, py, enemy.speed);
    enemy.facingAngle = Math.atan2(dy, dx);
    const shieldX = enemy.x + (dx / len) * 16;
    const shieldY = enemy.y + (dy / len) * 16;
    if (!enemy.shieldMark) {
      enemy.shieldMark = this.add.circle(shieldX, shieldY, 5, 0xb0bec5, 0.8).setDepth(5);
    } else {
      enemy.shieldMark.setPosition(shieldX, shieldY);
    }
  }

  updateTeleporter(enemy, px, py, now) {
    if (enemy.windupEndsAt > 0) {
      enemy.body.setVelocity(0, 0);
      const flashOn = Math.floor((enemy.windupEndsAt - now) / 80) % 2 === 0;
      enemy.setTint(flashOn ? 0xe040fb : 0x7c4dff);
      if (now >= enemy.windupEndsAt) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Phaser.Math.Between(
          CFG.teleporter.blinkMinDistance,
          CFG.teleporter.blinkMaxDistance,
        );
        enemy.x = Phaser.Math.Clamp(px + Math.cos(angle) * dist, 32, this.arenaW - 32);
        enemy.y = Phaser.Math.Clamp(py + Math.sin(angle) * dist, 32, this.arenaH - 32);
        enemy.clearTint();
        enemy.windupEndsAt = 0;
        enemy.blinkAt = now + CFG.teleporter.blinkCooldownMs;
      }
      return;
    }
    if (now >= enemy.blinkAt) {
      enemy.windupEndsAt = now + CFG.teleporter.windupMs;
      return;
    }
    this.chasePlayer(enemy, px, py, enemy.speed);
  }

  updateSniper(enemy, px, py, now) {
    const { dx, dy, len, nx, ny } = this.keepRange(
      enemy,
      px,
      py,
      CFG.sniper.minRange,
      CFG.sniper.maxRange,
      enemy.speed,
    );
    if (enemy.aimEndsAt > 0) {
      enemy.body.setVelocity(0, 0);
      if (enemy.aimLine) {
        enemy.aimLine.clear();
        enemy.aimLine.lineStyle(2, 0xff1744, 0.65);
        enemy.aimLine.lineBetween(
          enemy.x,
          enemy.y,
          enemy.x + enemy.aimDir.x * 900,
          enemy.y + enemy.aimDir.y * 900,
        );
      }
      if (now >= enemy.aimEndsAt) {
        this.fireEnemyShot(
          enemy,
          enemy.aimDir.x,
          enemy.aimDir.y,
          now,
          CFG.sniper.shotRadius,
          0xff1744,
          0xffebee,
          CFG.sniper.shotSpeed,
          CFG.sniper.shotLifetimeMs,
          CFG.sniper.shotDamage,
        );
        if (enemy.aimLine) enemy.aimLine.destroy();
        enemy.aimLine = null;
        enemy.aimEndsAt = 0;
        enemy.nextShotAt = now + CFG.sniper.cooldownMs;
      }
      return;
    }
    if (now >= enemy.nextShotAt && len <= CFG.sniper.maxRange + 120) {
      enemy.aimDir = { x: dx / len || nx, y: dy / len || ny };
      enemy.aimEndsAt = now + CFG.sniper.aimMs;
      enemy.aimLine = this.add.graphics().setDepth(3.8);
    }
  }

  updateEgg(enemy, now) {
    enemy.body.setVelocity(0, 0);
    if (now < enemy.nextHatchAt) return;
    enemy.nextHatchAt = now + CFG.egg.hatchCooldownMs;
    for (let i = 0; i < CFG.egg.hatchCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.createSplitterChild(enemy.x + Math.cos(angle) * 24, enemy.y + Math.sin(angle) * 24);
    }
    enemy.setTint(0xffd54f);
    this.time.delayedCall(160, () => {
      if (enemy.active) this.applyDamageTint(enemy);
    });
  }

  updateSlime(enemy, px, py, now) {
    this.chasePlayer(enemy, px, py, enemy.speed);
    if (now < enemy.nextPuddleAt) return;
    enemy.nextPuddleAt = now + CFG.slime.puddleCooldownMs;
    this.createPoisonPuddle(enemy.x, enemy.y, now);
  }

  keepRange(enemy, px, py, minRange, maxRange, speed) {
    const dx = px - enemy.x;
    const dy = py - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    if (len > maxRange) enemy.body.setVelocity(nx * speed, ny * speed);
    else if (len < minRange) enemy.body.setVelocity(-nx * speed, -ny * speed);
    else enemy.body.setVelocity(-ny * speed * 0.55, nx * speed * 0.55);
    return { dx, dy, len, nx, ny };
  }

  fireEnemyFireball(enemy, dirX, dirY, time) {
    this.fireEnemyShot(
      enemy,
      dirX,
      dirY,
      time,
      CFG.enemyFireball.radius,
      CFG.enemyFireball.color,
      CFG.enemyFireball.coreColor,
      CFG.enemyFireball.speed,
      CFG.enemyFireball.lifetimeMs,
      CFG.enemyFireball.damage,
    );
  }

  fireEnemyShot(enemy, dirX, dirY, time, radius, color, coreColor, speed, lifetimeMs, damage) {
    const spawnX = enemy.x + dirX * 18;
    const spawnY = enemy.y + dirY * 18;
    const fireball = this.add.circle(spawnX, spawnY, radius, color);
    fireball.setStrokeStyle(2, coreColor, 0.9);
    fireball.setDepth(4.5);
    this.physics.add.existing(fireball);
    this.enemyProjectiles.add(fireball);
    fireball.body.setCircle(radius);
    fireball.body.setOffset(-radius, -radius);
    fireball.body.setVelocity(dirX * speed, dirY * speed);
    fireball.expiresAt = time + lifetimeMs;
    fireball.damage = damage;
    this.tweens.add({
      targets: fireball,
      scale: { from: 0.9, to: 1.18 },
      alpha: { from: 0.95, to: 0.75 },
      yoyo: true,
      repeat: -1,
      duration: 180,
    });
  }

  explodeEnemy(x, y, radius, damagesPlayer, source = null) {
    const blast = this.add.circle(x, y, radius, 0xff7043, 0.28).setDepth(4.2);
    this.tweens.add({
      targets: blast,
      alpha: 0,
      scale: 1.2,
      duration: 260,
      onComplete: () => blast.destroy(),
    });
    if (damagesPlayer) {
      const d = Phaser.Math.Distance.Between(x, y, this.player.sprite.x, this.player.sprite.y);
      if (d <= radius) this.damagePlayer(CFG.bomber.explosionDamage);
    }
    // The blast also damages other enemies within range (the boss is immune).
    const rSq = radius * radius;
    this.enemies
      .getChildren()
      .slice()
      .forEach((e) => {
        if (e === source || !e.active || e.type === 'boss') return;
        if (Phaser.Math.Distance.Squared(x, y, e.x, e.y) <= rSq) {
          this.damageEnemy(e, x, y, CFG.bomber.explosionDamage);
        }
      });
  }

  // Phoenix revive: a gold shockwave that destroys nearby (non-boss) enemies.
  phoenixBlast() {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const radius = CFG.player.phoenixBlastRadius;
    const blast = this.add.circle(px, py, radius, 0xffd54f, 0.35).setDepth(4.3);
    this.tweens.add({
      targets: blast,
      alpha: 0,
      scale: 1.4,
      duration: 320,
      onComplete: () => blast.destroy(),
    });
    const rSq = radius * radius;
    this.enemies
      .getChildren()
      .slice()
      .forEach((e) => {
        if (!e.active || e.type === 'boss') return;
        if (Phaser.Math.Distance.Squared(px, py, e.x, e.y) <= rSq) {
          this.damageEnemy(e, px, py, CFG.player.phoenixBlastDamage);
        }
      });
    this.cameras.main.shake(160, 0.006);
  }

  createPoisonPuddle(x, y, time) {
    const puddle = this.add.circle(x, y, CFG.slime.puddleRadius, 0x7cb342, 0.24).setDepth(2.5);
    this.physics.add.existing(puddle);
    this.hazards.add(puddle);
    puddle.body.setCircle(CFG.slime.puddleRadius);
    puddle.body.setOffset(-CFG.slime.puddleRadius, -CFG.slime.puddleRadius);
    puddle.expiresAt = time + CFG.slime.puddleLifetimeMs;
    puddle.damage = CFG.slime.puddleDamage;
    puddle.nextDamageAt = 0;
    this.tweens.add({
      targets: puddle,
      alpha: { from: 0.24, to: 0.36 },
      yoyo: true,
      repeat: -1,
      duration: 420,
    });
  }

  // Set the run's starting point and kick off the first wave. Shared by the
  // initial run boot (new game / checkpoint continue) and the jumpToWave cheat
  // so the "start at wave N" logic stays in one place. Enemy difficulty scales
  // off this.wave, so a mid-game start is correctly difficult. `n` is the wave
  // the player will be ON after this call (startNextWave increments from n-1).
  beginAtWave(n) {
    this.wave = Math.max(1, Math.floor(n)) - 1;
    this.startNextWave();
  }

  startNextWave() {
    this.wave += 1;
    const n = this.wave;
    // Enemy speed scales with the wave but stops growing past speedCapWave.
    const speedWave = Math.min(n, CFG.waves.speedCapWave);
    this.enemySpeedThisWave = CFG.enemy.speed + CFG.waves.enemySpeedGrowth * (speedWave - 1);

    if (this.isBossWave(n)) {
      this.startBossWave(n);
      return;
    }

    const count = CFG.waves.baseCount + CFG.waves.growthPerWave * (n - 1);
    this.pendingSpawns = count;
    this.waveTotalEnemies = count; // baseline for the wave progress bar

    this.activeSpawnEvent = this.time.addEvent({
      delay: CFG.waves.spawnIntervalMs,
      repeat: count - 1,
      callback: () => this.spawnEnemy(),
    });

    this.showWaveBanner(`WAVE ${n}`);
    // Wave 1 already gets the run-start sting; only later waves use the wave fanfare.
    if (n > 1) playSfx(this, 'waveStart');
  }

  showWaveBanner(text, color = '#ffffff', fontSize = '32px') {
    if (this.waveBanner) this.waveBanner.destroy();
    this.waveBanner = this.add
      .text(this.arenaW / 2, 60, text, {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize,
        color,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: this.waveBanner,
      alpha: 0,
      duration: 1200,
      delay: 600,
      onComplete: () => {
        if (this.waveBanner) {
          this.waveBanner.destroy();
          this.waveBanner = null;
        }
      },
    });
  }

  isBossWave(n) {
    return CFG.boss.everyNWaves > 0 && n % CFG.boss.everyNWaves === 0;
  }

  maybeStartNextWave() {
    if (this.gameOver) return;
    if (this.demo || this.tutorial) return; // sandbox / scripted tutorial: no wave progression
    if (this.bossSpawning) return; // a boss shadow is telegraphing; hold the wave
    if (this.pendingSpawns > 0) return;
    if (this.enemies.countActive(true) > 0) return;
    if (this.nextWaveScheduled) return;

    this.payWaveClearBonus();
    // Boss waves get their own defeat fanfare, so skip the generic clear jingle.
    if (this.wave > 0 && !this.isBossWave(this.wave)) playSfx(this, 'waveClear');

    this.nextWaveScheduled = true;
    this.nextWaveDelayedCall = this.time.delayedCall(CFG.waves.interWaveDelayMs, () => {
      this.nextWaveScheduled = false;
      this.nextWaveDelayedCall = null;
      this.startNextWave();
    });
  }

  onBulletHitEnemy(bullet, enemy) {
    const mods = bullet.bulletMods || {};
    // Piercing bullets linger inside the large boss body across many physics
    // steps; throttle re-hits so they do not deal runaway damage.
    if (mods.piercing && enemy.type === 'boss') {
      if (bullet.bossHitAt && this.time.now - bullet.bossHitAt < CFG.boss.pierceHitCooldownMs) {
        return;
      }
      bullet.bossHitAt = this.time.now;
    }
    if (!mods.piercing) {
      bullet.destroy();
    }
    const ex = enemy.x;
    const ey = enemy.y;
    const damage = this.damageEnemy(enemy, bullet.x, bullet.y, 1);
    if (damage <= 0) return;
    if (!this.demo && !bullet.countedHit) {
      bullet.countedHit = true;
      this.runStats.shotsHit += 1;
    }

    if (mods.aoeRadius) {
      const r = mods.aoeRadius;
      const rSq = r * r;
      const splash = this.add.circle(ex, ey, r, 0xff7043, 0.25);
      this.tweens.add({
        targets: splash,
        alpha: 0,
        scale: 1.2,
        duration: 200,
        onComplete: () => splash.destroy(),
      });
      this.enemies.getChildren().forEach((e) => {
        const d = Phaser.Math.Distance.Squared(ex, ey, e.x, e.y);
        if (d <= rSq) {
          this.damageEnemy(e, ex, ey, 1);
        }
      });
    } else if (enemy.active) {
      return;
    }

    this.maybeStartNextWave();
  }

  damageEnemy(enemy, sourceX, sourceY, amount) {
    if (!enemy.active) return 0;
    if (enemy.type === 'boss') return this.damageBoss(enemy, sourceX, sourceY, amount);
    let damage = amount;
    let frontBlocked = false;
    if (enemy.type === 'shielded') {
      const hitAngle = Math.atan2(sourceY - enemy.y, sourceX - enemy.x);
      const diff = Math.abs(Phaser.Math.Angle.Wrap(hitAngle - enemy.facingAngle));
      if (diff < Math.PI / 2) {
        damage *= CFG.shielded.frontDamageMult;
        frontBlocked = true;
      }
    }
    enemy.hp -= damage;
    if (enemy.hp > 0) {
      this.flashEnemyHit(enemy, frontBlocked);
      playSfx(this, 'enemyHit');
      return damage;
    }
    const ex = enemy.x;
    const ey = enemy.y;
    const type = enemy.type;
    this.cleanupEnemyExtras(enemy);
    enemy.destroy();
    this.onEnemyKilled(type, ex, ey);
    return damage;
  }

  // Brief hit flash, then settle to the enemy's persistent visual state.
  flashEnemyHit(enemy, frontBlocked = false) {
    enemy.setTint(frontBlocked ? 0xb0bec5 : 0xffffff);
    if (enemy.hitSettleEvent) enemy.hitSettleEvent.remove(false);
    enemy.hitSettleEvent = this.time.delayedCall(frontBlocked ? 90 : 80, () => {
      enemy.hitSettleEvent = null;
      this.applyDamageTint(enemy);
    });
  }

  // Multi-HP enemies keep a "broken" tint that deepens as their HP drops, so
  // damage stays visible until they die. Others restore their normal look.
  applyDamageTint(enemy) {
    if (!enemy.active) return;
    if (enemy.maxHp > 1 && enemy.hp > 0 && enemy.hp < enemy.maxHp) {
      const t = Phaser.Math.Clamp(1 - enemy.hp / enemy.maxHp, 0, 1);
      const c = Phaser.Display.Color.Interpolate.RGBWithRGB(
        255,
        255,
        255,
        140,
        50,
        40,
        100,
        Math.round(t * 100),
      );
      enemy.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      return;
    }
    if (enemy.type === 'dasher') {
      enemy.setTint(enemy.baseTint);
      return;
    }
    enemy.clearTint();
  }

  cleanupEnemyExtras(enemy) {
    this.cancelBossAction(enemy);
    if (enemy.pulseTween) {
      enemy.pulseTween.remove();
      enemy.pulseTween = null;
    }
    if (enemy.shieldMark) enemy.shieldMark.destroy();
    if (enemy.aimLine) enemy.aimLine.destroy();
    if (enemy.core) enemy.core.destroy();
    if (enemy.shieldRingGfx) enemy.shieldRingGfx.destroy();
    if (enemy.telegraph) enemy.telegraph.destroy();
    if (enemy.weakPoints) {
      for (const node of enemy.weakPoints) node.destroy();
      enemy.weakPoints = [];
    }
  }

  onEnemyKilled(type, x, y) {
    if (this.demo) {
      this.scheduleDemoRespawn();
      return;
    }
    if (this.tutorial) this.tutorialKills = (this.tutorialKills || 0) + 1;
    if (type === 'boss') {
      this.runStats.bosses += 1;
      if (!this.bossHitTaken) this.runStats.bossNoHit = true;
    } else {
      this.runStats.killsByType[type] = (this.runStats.killsByType[type] || 0) + 1;
      playSfx(this, 'enemyDeath');
    }
    this.killEnemyScoring(x, y);
    // Bosses keep their dedicated bossDeathBurst; every other kill pops shards
    // tinted to the enemy, sized by the now-updated combo multiplier.
    if (type !== 'boss') this.spawnKillBurst(x, y, type);
    if (type === 'splitter') {
      for (let i = 0; i < CFG.splitter.childCount; i++) {
        const angle = (Math.PI * 2 * i) / CFG.splitter.childCount;
        this.createSplitterChild(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18);
      }
    } else if (type === 'bomber') {
      this.explodeEnemy(x, y, CFG.bomber.explosionRadius, true);
    } else if (type === 'boss') {
      playSfx(this, 'bossDefeat');
      this.payBossReward(x, y);
      this.bossDeathBurst(x, y);
      if (CFG.boss.clearAddsOnBossDeath) this.clearBossAdds();
      // Genuine boss defeat → advance the persistent checkpoint. Recorded here
      // (not in teardownBossState, which jumpToWave/player-death also hit) so
      // only a real kill moves it. setCheckpointWave is monotonic + capped.
      Save.setCheckpointWave(this.wave);
      this.teardownBossState();
    }
  }

  killEnemyScoring(x, y) {
    const prevCombo = this.comboMultiplier;
    this.comboMultiplier = Math.min(this.comboMultiplier + 1, CFG.combo.maxMultiplier);
    if (this.comboMultiplier > prevCombo) {
      playSfx(this, 'comboUp');
    }
    if (this.comboMultiplier > this.runStats.longestCombo) {
      this.runStats.longestCombo = this.comboMultiplier;
    }
    this.lastKillAt = this.time.now;
    this.score += CFG.combo.scorePerKillBase * this.comboMultiplier;
    this.dropCoinsForKill(x, y);
  }

  // ── Kill-burst shards ───────────────────────────────────────────────────
  // A pooled set of small square game objects that fly outward from a kill and
  // fade out. Simulated manually in updateKillShards() (called after the paused
  // guard in update()) so the effect freezes cleanly on pause / game over.

  initKillBurst() {
    this.killShards = [];
  }

  // Reuse an inactive shard, or grow the pool up to CFG.kill.maxShards. Returns
  // null when the cap is hit so a high-combo burst simply emits fewer shards
  // instead of leaking objects.
  getKillShard() {
    for (const shard of this.killShards) {
      if (!shard.active) return shard;
    }
    if (this.killShards.length >= CFG.kill.maxShards) return null;
    const shard = this.add
      .rectangle(0, 0, CFG.kill.shardSize, CFG.kill.shardSize, 0xffffff)
      .setDepth(KILL_SHARD_DEPTH)
      .setActive(false)
      .setVisible(false);
    this.killShards.push(shard);
    return shard;
  }

  spawnKillBurst(x, y, type) {
    const k = CFG.kill;
    const color = k.shardColors[type] ?? k.defaultColor;
    // Visual scaling is clamped at CFG.combo.effectScaleCap so shard count/size
    // stop growing past x8 even though the multiplier itself can reach x50.
    const step = Math.min(this.comboMultiplier, CFG.combo.effectScaleCap) - 1;
    const count = k.burstBaseCount + k.burstPerCombo * step;
    const size = k.shardSize + k.shardSizePerCombo * step;
    for (let i = 0; i < count; i++) {
      const shard = this.getKillShard();
      if (!shard) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = Phaser.Math.FloatBetween(k.speedMin, k.speedMax);
      shard.vx = Math.cos(angle) * speed;
      shard.vy = Math.sin(angle) * speed;
      shard.life = k.lifespanMs;
      shard.maxLife = k.lifespanMs;
      shard.setPosition(x, y);
      shard.setFillStyle(color, 1);
      shard.setDisplaySize(size, size);
      shard.setAlpha(1);
      shard.setActive(true).setVisible(true);
    }
  }

  updateKillShards(delta) {
    if (!this.killShards) return;
    const dt = delta / 1000;
    const damp = Math.max(0, 1 - CFG.kill.drag * dt);
    for (const shard of this.killShards) {
      if (!shard.active) continue;
      shard.life -= delta;
      if (shard.life <= 0) {
        shard.setActive(false).setVisible(false);
        continue;
      }
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      shard.vx *= damp;
      shard.vy *= damp;
      shard.setAlpha(shard.life / shard.maxLife);
    }
  }

  destroyKillShards() {
    if (!this.killShards) return;
    for (const shard of this.killShards) shard.destroy();
    this.killShards = [];
  }

  dropCoinsForKill(x, y) {
    // Enemies during a boss fight (the boss's own minions) drop no coins;
    // the boss itself drops one big collectible coin instead (see payBossReward).
    // Tutorial spawns its own coins for the coin step, so kills drop none.
    if (this.bossActive || this.demo || this.tutorial) return;
    // Per-kill coins scale with the combo but are clamped at effectScaleCap so the
    // economy stays balanced while the multiplier can still climb to x50 for score.
    const comboBonus = Math.min(this.comboMultiplier, CFG.combo.effectScaleCap) - 1;
    const base = CFG.store.coinDropPerKillBase + comboBonus;
    let amount = Math.max(1, Math.round(base * this.runtime.coinDropMult));
    if (this.runtime.luckyChance > 0 && Math.random() < this.runtime.luckyChance) {
      amount *= 2;
    }
    this.spawnCoins(x, y, amount);
  }

  spawnCoins(x, y, n) {
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const sp = CFG.coin.dropSpeed * (0.6 + Math.random() * 0.8);
      const coin = this.add.circle(x, y, CFG.coin.radius, CFG.coin.color);
      coin.setStrokeStyle(1, 0xffffff, 0.4);
      this.physics.add.existing(coin);
      this.coins.add(coin);
      coin.body.setCircle(CFG.coin.radius);
      coin.body.setOffset(-CFG.coin.radius, -CFG.coin.radius);
      coin.body.setVelocity(Math.cos(angle) * sp, Math.sin(angle) * sp);
      coin.value = 1;
      coin.expiresAt = this.time.now + CFG.coin.lifetimeMs;
    }
  }

  // A single large coin carrying a coin value > 1 (boss reward). Collected like
  // any coin, but credits its full value at once.
  spawnBigCoin(x, y, value) {
    const r = CFG.coin.bigRadius;
    const coin = this.add.circle(x, y, r, CFG.coin.color);
    coin.setStrokeStyle(3, 0xffffff, 0.95).setDepth(3.5);
    this.physics.add.existing(coin);
    this.coins.add(coin);
    coin.body.setCircle(r);
    coin.body.setOffset(-r, -r);
    coin.value = value;
    this.tweens.add({
      targets: coin,
      scale: { from: 0.8, to: 1.15 },
      yoyo: true,
      repeat: -1,
      duration: 500,
      ease: 'Sine.inOut',
    });
  }

  onPlayerCoin(_playerSprite, coin) {
    const value = coin.value || 1;
    coin.destroy();
    playSfx(this, 'coin');
    // Tutorial coins are illustrative: count them for the step but don't touch
    // the real wallet or run total.
    if (this.tutorial) {
      this.tutorialCoins = (this.tutorialCoins || 0) + value;
      return;
    }
    this.coinsThisRun += value;
    Save.addToWallet(value);
    playSfx(this, value > 1 ? 'coinBig' : 'coin');
    if (value > 1) {
      this.showFloatingText(
        this.player.sprite.x,
        this.player.sprite.y - 30,
        `+${value} ¢`,
        '#ffd54f',
      );
    }
    this.updateHUD(this.time.now);
  }

  onPlayerHitEnemy(_playerSprite, enemy) {
    if (this.demo) return; // sandbox: contact does nothing, keep the monster alive
    // Tutorial: the player can't die and targets must survive contact so they
    // can only be destroyed by shooting (which drives the kill/combo steps).
    if (this.tutorial) return;
    if (this.time.now < this.player.invulnerableUntil) return;

    // The boss is never destroyed by contact; it just damages the player.
    const isBoss = enemy.type === 'boss';

    if (this.shieldActive) {
      if (!isBoss) {
        this.cleanupEnemyExtras(enemy);
        enemy.destroy();
      }
      this.shieldHitsRemaining -= 1;
      playSfx(this, 'shieldBlock');
      this.player.invulnerableUntil = this.time.now + 200;
      this.tweens.add({
        targets: this.shieldRing,
        alpha: { from: 0.3, to: 1 },
        scale: { from: 1.25, to: 1 },
        duration: 220,
        ease: 'Quad.out',
      });
      if (this.shieldHitsRemaining <= 0) {
        this.endShield();
      }
      this.maybeStartNextWave();
      return;
    }

    if (!isBoss) {
      this.cleanupEnemyExtras(enemy);
      enemy.destroy();
    }
    this.player.hp -= this.getEnemyContactDamage(enemy.type);
    this.bossHitTaken = true;
    this.breakCombo();
    playSfx(this, 'playerHit');
    this.player.invulnerableUntil = this.time.now + CFG.player.hitFlashMs * 2;
    this.player.hitUntil = this.time.now + CFG.player.hitFlashMs;

    this.tweens.add({
      targets: this.player.sprite,
      alpha: 0.3,
      duration: CFG.player.hitFlashMs,
      yoyo: true,
      onComplete: () => {
        this.player.sprite.setAlpha(1);
        this.player.sprite.setScale(PLAYER_BODY_SCALE);
      },
    });

    this.cameras.main.shake(120, 0.005);

    if (this.player.hp <= 0) {
      if (this.phoenixCharges > 0) {
        this.phoenixCharges -= 1;
        this.player.hp = 1;
        this.phoenixBlast();
        this.activateShield();
        this.showFloatingText(
          this.player.sprite.x,
          this.player.sprite.y - 30,
          'PHOENIX',
          '#ffd54f',
        );
        this.maybeStartNextWave();
      } else {
        this.endGame();
      }
    } else {
      this.maybeStartNextWave();
    }
  }

  getEnemyContactDamage(type) {
    return CFG[type]?.contactDamage || CFG.enemy.contactDamage;
  }

  onPlayerHitEnemyProjectile(_playerSprite, projectile) {
    // While invulnerable (e.g. dashing), let projectiles pass through instead of
    // being consumed harmlessly, so dashing doesn't delete incoming shots.
    if (this.time.now < this.player.invulnerableUntil) return;
    projectile.destroy();
    this.damagePlayer(projectile.damage || CFG.enemyFireball.damage);
  }

  onPlayerHitHazard(_playerSprite, hazard) {
    if (this.time.now < hazard.nextDamageAt) return;
    hazard.nextDamageAt = this.time.now + 650;
    this.damagePlayer(hazard.damage || 1);
  }

  damagePlayer(amount) {
    if (this.demo || this.tutorial) return; // sandbox / tutorial: player is invulnerable
    if (this.time.now < this.player.invulnerableUntil) return;

    if (this.shieldActive) {
      this.shieldHitsRemaining -= 1;
      playSfx(this, 'shieldBlock');
      this.player.invulnerableUntil = this.time.now + 200;
      this.tweens.add({
        targets: this.shieldRing,
        alpha: { from: 0.3, to: 1 },
        scale: { from: 1.25, to: 1 },
        duration: 220,
        ease: 'Quad.out',
      });
      if (this.shieldHitsRemaining <= 0) {
        this.endShield();
      }
      return;
    }

    this.player.hp -= amount;
    this.bossHitTaken = true;
    this.breakCombo();
    playSfx(this, 'playerHit');
    this.player.invulnerableUntil = this.time.now + CFG.player.hitFlashMs * 2;
    this.player.hitUntil = this.time.now + CFG.player.hitFlashMs;

    this.tweens.add({
      targets: this.player.sprite,
      alpha: 0.3,
      duration: CFG.player.hitFlashMs,
      yoyo: true,
      onComplete: () => {
        this.player.sprite.setAlpha(1);
        this.player.sprite.setScale(PLAYER_BODY_SCALE);
      },
    });

    this.cameras.main.shake(120, 0.005);

    if (this.player.hp <= 0) {
      if (this.phoenixCharges > 0) {
        this.phoenixCharges -= 1;
        this.player.hp = 1;
        this.phoenixBlast();
        this.activateShield();
        this.showFloatingText(
          this.player.sprite.x,
          this.player.sprite.y - 30,
          'PHOENIX',
          '#ffd54f',
        );
      } else {
        this.endGame();
      }
    }
  }

  showFloatingText(x, y, text, color = '#ffffff') {
    const t = this.add
      .text(x, y, text, {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '16px',
        color,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 900,
      ease: 'Quad.out',
      onComplete: () => t.destroy(),
    });
  }

  endGame() {
    this.gameOver = true;
    this.cancelSlowMo();
    // Player can die mid-boss; stop the boss track so it doesn't ride into the menu.
    exitBossMusic(this);
    this.exitBossBackground();
    if (this.boss) this.cancelBossAction(this.boss);
    playSfx(this, 'lose');
    this.player.sprite.setTexture(this.playerFrameKey(this.player.facing, 'death'));
    this.player.barrel.setVisible(false);
    this.physics.pause();
    if (this.shieldPickup) this.despawnShieldBonus();
    if (this.giftPickup) this.despawnGift();
    if (this.shieldActive) this.endShield();
    const { saved, summary, newAchievements } = this.finalizeRun();
    this.time.delayedCall(400, () => {
      this.scene.start('MainMenuScene', {
        gameOver: true,
        score: this.score,
        wave: this.wave,
        coinsEarned: this.coinsThisRun,
        walletSaved: saved.wallet,
        summary,
        newAchievements,
      });
    });
  }

  // Builds the per-run summary, records the run into Save.stats, then evaluates
  // and persists any newly unlocked achievements. Coins are already credited live
  // during play, so persistCoins is false to avoid double-counting.
  finalizeRun() {
    const summary = this.buildRunSummary();
    const saved = Save.recordRun({
      wave: this.wave,
      score: this.score,
      coinsEarned: this.coinsThisRun,
      persistCoins: false,
      longestCombo: summary.longestCombo,
      kills: summary.kills,
      bosses: summary.bosses,
    });
    const newAchievements = evaluateAchievements(
      { run: summary, stats: saved.stats, save: saved },
      saved.achievements,
    );
    if (newAchievements.length) Save.unlockAchievements(newAchievements);
    return { saved, summary, newAchievements };
  }

  buildRunSummary() {
    const killsByType = this.runStats.killsByType;
    const kills = Object.values(killsByType).reduce((a, b) => a + b, 0);
    return {
      wave: this.wave,
      score: this.score,
      coinsEarned: this.coinsThisRun,
      durationMs: Math.max(0, this.time.now - this.runStats.startTime),
      killsByType,
      kills,
      bosses: this.runStats.bosses,
      longestCombo: this.runStats.longestCombo,
      shotsFired: this.runStats.shotsFired,
      shotsHit: this.runStats.shotsHit,
      bossNoHit: this.runStats.bossNoHit,
    };
  }

  payWaveClearBonus() {
    if (this.wave < 1) return;
    const bonus = CFG.store.waveClearBase + CFG.store.waveClearPerWave * this.wave;
    const amount = Math.max(1, Math.round(bonus * this.runtime.coinDropMult));
    this.coinsThisRun += amount;
    Save.addToWallet(amount);
    this.showFloatingText(
      this.player.sprite.x,
      this.player.sprite.y - 40,
      `+${amount} ¢`,
      '#ffd54f',
    );
    this.updateHUD(this.time.now);
  }

  maybeDecayCombo(time) {
    if (this.comboMultiplier > 1 && time - this.lastKillAt > this.runtime.comboResetMs) {
      this.breakCombo();
    }
  }

  // Reset the kill-streak multiplier, with a short "deflate" cue if a combo was lost.
  breakCombo() {
    if (this.comboMultiplier > 1) playSfx(this, 'comboBreak');
    this.comboMultiplier = 1;
  }

  // Drop the whole arena into slow motion for CFG.bulletTime.durationMs (real time)
  // to punch up the boss kill. Slows both the Clock (this.time.timeScale, drives AI
  // cooldowns / spawn timers) and the Arcade physics step (this.physics.world.timeScale
  // > 1 = slower, drives all body movement). Restored via a wall-clock timer since the
  // Clock is slowed while it runs. Never fires when another system owns the game's time
  // state; a fresh trigger restarts any in-flight burst.
  triggerSlowMo() {
    if (this.demo || this.tutorial || this.paused || this.gameOver || this.cheatPromptActive) {
      return;
    }
    const s = CFG.bulletTime.scale;
    if (this.slowMoTimer != null) globalThis.clearTimeout(this.slowMoTimer);
    this.slowMoActive = true;
    this.time.timeScale = s;
    this.physics.world.timeScale = 1 / s;
    this.cameras.main.flash(160, 90, 140, 220, true);
    this.slowMoTimer = globalThis.setTimeout(() => this.endSlowMo(), CFG.bulletTime.durationMs);
  }

  // Restore real-time playback.
  endSlowMo() {
    if (!this.slowMoActive) return;
    this.slowMoActive = false;
    this.slowMoTimer = null;
    this.time.timeScale = 1;
    this.physics.world.timeScale = 1;
  }

  // Force real-time playback immediately — used by the paths that own the game's
  // time state (pause, cheat, death, exit, wave jump, shutdown) so a slowed Clock or
  // physics step can never leak into a menu, transition, or the next run.
  cancelSlowMo() {
    if (this.slowMoTimer != null) {
      globalThis.clearTimeout(this.slowMoTimer);
      this.slowMoTimer = null;
    }
    this.slowMoActive = false;
    // Called from the scene SHUTDOWN handler, by which point Phaser may have already
    // torn down the clock / physics world — guard so teardown never throws and
    // strands the scene transition.
    if (this.time) this.time.timeScale = 1;
    if (this.physics?.world) this.physics.world.timeScale = 1;
  }

  togglePause() {
    this.cancelSlowMo();
    this.paused = !this.paused;
    if (this.paused) {
      this.physics.pause();
      this.time.paused = true;
      this.setPauseMenuVisible(true);
    } else {
      this.physics.resume();
      this.time.paused = false;
      this.setPauseMenuVisible(false);
    }
  }

  // Restart the run from the pause menu. The physics world and time Clock are
  // reused across scene.start(), so their paused flags must be cleared first —
  // otherwise the fresh run boots paused and wave-spawn timers never fire.
  restartRun() {
    this.paused = false;
    this.physics.resume();
    this.time.paused = false;
    this.scene.start('GameScene');
  }

  // Builds the in-game pause menu (Resume / Restart / Settings / Quit) plus an
  // inline audio-settings sub-panel. Everything is created hidden and laid out
  // from the live arena size in layoutPauseMenu(); shown via setPauseMenuVisible.
  buildPauseMenu(style) {
    const pcfg = CFG.pause;
    this.pauseView = 'menu';
    this.pauseIndex = 0;
    this.pauseObjects = [];

    const add = (obj) => {
      obj.setDepth(pcfg.depth).setVisible(false);
      this.pauseObjects.push(obj);
      return obj;
    };

    // Full-canvas dim backdrop; interactive so taps behind the buttons are
    // swallowed instead of reaching the arena (matters on touch).
    this.pauseBackdrop = add(
      this.add
        .rectangle(0, 0, this.arenaW, this.arenaH, 0x000000, pcfg.backdropAlpha)
        .setOrigin(0)
        .setInteractive(),
    );

    this.pauseTitle = add(
      this.add
        .text(0, 0, 'PAUSED', { ...style, fontSize: '34px', color: '#ffffff' })
        .setOrigin(0.5),
    );

    this.pauseButtons = [
      { label: 'RESUME', action: () => this.togglePause() },
      { label: 'RESTART RUN', action: () => this.restartRun() },
      { label: 'SETTINGS', action: () => this.openPauseSettings() },
      { label: 'QUIT TO MENU', action: () => this.exitToMainMenu() },
    ];

    this.pauseButtonViews = this.pauseButtons.map((def, index) => {
      const bg = add(this.add.graphics());
      const label = add(
        this.add.text(0, 0, def.label, { ...style, fontSize: '22px' }).setOrigin(0, 0.5),
      );
      const zone = add(
        this.add
          .zone(0, 0, pcfg.buttonWidth, pcfg.buttonHeight)
          .setOrigin(0)
          .setInteractive({ useHandCursor: true })
          .on('pointerover', () => this.selectPauseButton(index))
          .on('pointerdown', () => this.activatePauseButton(index)),
      );
      return { bg, label, zone };
    });

    this.pauseHint = add(
      this.add
        .text(0, 0, '↑/↓ + Enter   •   click   •   P / Esc resume', {
          ...style,
          fontSize: '12px',
          color: '#cccccc',
        })
        .setOrigin(0.5),
    );

    // Inline settings sub-panel: Music + Sound toggles and a Back row. Each row is
    // a label + value text + a tappable zone; visible only while pauseView is
    // 'settings'.
    const makeSettingRow = (rowIndex, onClick) => {
      const label = add(this.add.text(0, 0, '', { ...style, fontSize: '20px' }).setOrigin(0, 0.5));
      const value = add(this.add.text(0, 0, '', { ...style, fontSize: '20px' }).setOrigin(1, 0.5));
      const zone = add(
        this.add
          .zone(0, 0, pcfg.buttonWidth, pcfg.buttonHeight)
          .setOrigin(0)
          .setInteractive({ useHandCursor: true })
          .on('pointerover', () => {
            this.pauseIndex = rowIndex;
            this.refreshPauseMenu();
          })
          .on('pointerdown', onClick),
      );
      return { label, value, zone };
    };
    this.pauseSettingsTitle = add(
      this.add
        .text(0, 0, 'SETTINGS', { ...style, fontSize: '22px', color: '#ffd54f' })
        .setOrigin(0.5),
    );
    this.pauseMusicRow = makeSettingRow(0, () => this.togglePauseMusic());
    this.pauseSfxRow = makeSettingRow(1, () => this.togglePauseSfx());
    this.pauseBackRow = makeSettingRow(2, () => this.closePauseSettings());

    this.layoutPauseMenu();
  }

  // Repositions every pause-menu object from the live arena size. Called from
  // layoutHud() so the menu recenters on a mobile rotate / fullscreen toggle.
  layoutPauseMenu() {
    if (!this.pauseObjects) return;
    const pcfg = CFG.pause;
    const cx = this.arenaW / 2;
    const cy = this.arenaH / 2;
    const left = cx - pcfg.buttonWidth / 2;

    this.pauseBackdrop?.setSize(this.arenaW, this.arenaH);
    this.pauseBackdrop?.setPosition(0, 0);
    this.pauseTitle?.setPosition(cx, cy + pcfg.titleOffsetY);

    const rowTop = (i) => cy + pcfg.firstButtonOffsetY + i * (pcfg.buttonHeight + pcfg.buttonGap);
    this.pauseButtonViews?.forEach((view, i) => {
      const top = rowTop(i);
      view.label.setPosition(left + 24, top + pcfg.buttonHeight / 2);
      view.zone.setPosition(left, top);
    });
    this.pauseHint?.setPosition(cx, rowTop(this.pauseButtons.length - 1) + pcfg.buttonHeight + 26);

    // Settings sub-panel rows share the same column geometry as the buttons.
    this.pauseSettingsTitle?.setPosition(cx, cy + pcfg.titleOffsetY + 56);
    const settingRows = [this.pauseMusicRow, this.pauseSfxRow, this.pauseBackRow];
    settingRows.forEach((row, i) => {
      if (!row) return;
      const top = rowTop(i);
      const midY = top + pcfg.buttonHeight / 2;
      row.label.setPosition(left + 24, midY);
      row.value.setPosition(left + pcfg.buttonWidth - 24, midY);
      row.zone.setPosition(left, top);
    });

    if (this.pauseObjects.some((o) => o.visible)) this.refreshPauseMenu();
  }

  setPauseMenuVisible(visible) {
    if (visible) {
      this.pauseView = 'menu';
      this.pauseIndex = 0;
      this.refreshPauseMenu();
    } else {
      for (const obj of this.pauseObjects) {
        obj.setVisible(false);
        obj.input && obj.disableInteractive();
      }
    }
  }

  // Shows the rows for the current pauseView and repaints button highlights and
  // setting values. The single source of truth for pause-overlay visuals.
  refreshPauseMenu() {
    const inMenu = this.pauseView === 'menu';

    this.pauseBackdrop.setVisible(true).setInteractive();
    this.pauseTitle.setVisible(inMenu);
    this.pauseHint.setVisible(inMenu);

    this.pauseButtonViews.forEach((view, i) => {
      view.label.setVisible(inMenu);
      view.bg.setVisible(inMenu);
      view.zone.setVisible(inMenu);
      if (inMenu) view.zone.setInteractive({ useHandCursor: true });
      else view.zone.disableInteractive();
      if (inMenu) this.drawPauseButton(i, i === this.pauseIndex);
    });

    this.pauseSettingsTitle.setVisible(!inMenu);
    const rows = [this.pauseMusicRow, this.pauseSfxRow, this.pauseBackRow];
    const settings = Save.get().settings || {};
    const labels = [
      ['MUSIC', settings.musicEnabled !== false ? 'ON' : 'OFF'],
      ['SOUND', settings.sfxEnabled !== false ? 'ON' : 'OFF'],
      ['‹ BACK', ''],
    ];
    rows.forEach((row, i) => {
      const [labelText, valueText] = labels[i];
      const selected = !inMenu && i === this.pauseIndex;
      row.label.setText(labelText).setVisible(!inMenu);
      row.label.setColor(selected ? '#ffffff' : '#bbbbbb');
      row.value.setText(valueText).setColor(valueText === 'ON' ? '#69f0ae' : '#ff8a80');
      row.value.setVisible(!inMenu && valueText !== '');
      row.zone.setVisible(!inMenu);
      if (!inMenu) row.zone.setInteractive({ useHandCursor: true });
      else row.zone.disableInteractive();
    });
  }

  // Draws a single pause button's rounded-rect (selected = accent caret + thicker
  // border + brighter label), mirroring MainMenuScene.selectAction.
  drawPauseButton(index, selected) {
    const pcfg = CFG.pause;
    const view = this.pauseButtonViews[index];
    const w = pcfg.buttonWidth;
    const h = pcfg.buttonHeight;
    const x = this.arenaW / 2 - w / 2;
    const top = this.arenaH / 2 + pcfg.firstButtonOffsetY + index * (h + pcfg.buttonGap);
    view.bg.clear();
    view.bg.fillStyle(0x101710, selected ? 0.96 : 0.82);
    view.bg.fillRoundedRect(x, top, w, h, 8);
    view.bg.lineStyle(selected ? 4 : 2, pcfg.accent, 1);
    view.bg.strokeRoundedRect(x, top, w, h, 8);
    if (selected) {
      view.bg.fillStyle(pcfg.accent, 1);
      view.bg.fillTriangle(x - 14, top + h / 2, x - 3, top + h / 2 - 7, x - 3, top + h / 2 + 7);
    }
    view.label.setColor(selected ? '#ffffff' : '#dddddd');
  }

  selectPauseButton(index) {
    const next = Phaser.Math.Wrap(index, 0, this.pauseButtons.length);
    if (next !== this.pauseIndex) playSfx(this, 'uiMove');
    this.pauseIndex = next;
    this.pauseButtonViews.forEach((_, i) => {
      this.drawPauseButton(i, i === this.pauseIndex);
    });
  }

  activatePauseButton(index) {
    playSfx(this, 'uiConfirm');
    this.pauseButtons[index]?.action();
  }

  // Keyboard navigation shared by both pause views. Row count depends on the view
  // (4 menu buttons vs. 3 settings rows).
  movePauseSelection(delta) {
    const count = this.pauseView === 'menu' ? this.pauseButtons.length : 3;
    const next = Phaser.Math.Wrap(this.pauseIndex + delta, 0, count);
    if (next !== this.pauseIndex) playSfx(this, 'uiMove');
    this.pauseIndex = next;
    this.refreshPauseMenu();
  }

  activatePauseSelection() {
    if (this.pauseView === 'menu') {
      this.activatePauseButton(this.pauseIndex);
      return;
    }
    // Settings rows: each handler plays its own SFX (toggle confirm / back cancel).
    [() => this.togglePauseMusic(), () => this.togglePauseSfx(), () => this.closePauseSettings()][
      this.pauseIndex
    ]?.();
  }

  openPauseSettings() {
    this.pauseView = 'settings';
    this.refreshPauseMenu();
  }

  closePauseSettings() {
    playSfx(this, 'uiCancel');
    this.pauseView = 'menu';
    this.pauseIndex = 0;
    this.refreshPauseMenu();
  }

  togglePauseMusic() {
    const enabled = Save.get().settings?.musicEnabled !== false;
    Save.setMusicEnabled(!enabled);
    syncMusic(this);
    this.refreshPauseMenu();
  }

  togglePauseSfx() {
    const enabled = Save.get().settings?.sfxEnabled !== false;
    Save.setSfxEnabled(!enabled);
    // Audible confirmation when turning sound on (playSfx is a no-op when off).
    playSfx(this, 'uiConfirm');
    this.refreshPauseMenu();
  }

  exitToMainMenu() {
    if (this.gameOver) return;
    this.cancelSlowMo();
    this.input.setDefaultCursor('default');
    this.paused = false;
    this.cheatPromptActive = false;
    this.physics.resume();
    this.time.paused = false;
    // A tutorial is not a real run: don't record stats or touch the wallet.
    if (this.tutorial) {
      this.scene.start('MainMenuScene');
      return;
    }
    // Record the run on exit just like death does (stats + achievements). The
    // plain menu is shown without a summary panel since this is a manual exit.
    this.finalizeRun();
    this.scene.start('MainMenuScene');
  }

  scheduleNextShieldBonus() {
    if (this.gameOver || this.tutorial) return;
    const delay = Phaser.Math.Between(
      CFG.shieldBonus.spawnDelayMinMs,
      CFG.shieldBonus.spawnDelayMaxMs,
    );
    this.time.delayedCall(delay, () => this.spawnShieldBonus());
  }

  spawnShieldBonus() {
    if (this.gameOver) return;
    if (this.shieldPickup) return;

    const pad = CFG.shieldBonus.edgePadding;
    const x = Phaser.Math.Between(pad, this.arenaW - pad);
    const y = Phaser.Math.Between(pad, this.arenaH - pad);

    const points = this.buildStarPoints(
      CFG.shieldBonus.outerRadius,
      CFG.shieldBonus.innerRadius,
      5,
    );
    const star = this.add.polygon(x, y, points, CFG.shieldBonus.color);
    star.setStrokeStyle(2, 0xffffff, 0.8);
    this.physics.add.existing(star);
    // setCircle already centres the circular body on the star; an extra negative
    // offset here would push the hitbox off the visible shape (uncollectable).
    star.body.setCircle(CFG.shieldBonus.outerRadius);
    star.body.setImmovable(true);

    star.pulseTween = this.tweens.add({
      targets: star,
      scale: { from: 0.9, to: 1.15 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    star.rotateTween = this.tweens.add({
      targets: star,
      angle: 360,
      duration: 3000,
      repeat: -1,
    });

    this.shieldPickup = star;

    this.shieldPickupOverlap = this.physics.add.overlap(
      this.player.sprite,
      star,
      this.pickupShieldBonus,
      null,
      this,
    );

    this.shieldWarnEvent = this.time.delayedCall(
      CFG.shieldBonus.lifetimeMs - CFG.shieldBonus.warnLastMs,
      () => {
        if (!this.shieldPickup) return;
        this.tweens.add({
          targets: this.shieldPickup,
          alpha: { from: 1, to: 0.25 },
          duration: 180,
          yoyo: true,
          repeat: -1,
        });
      },
    );

    this.shieldDespawnEvent = this.time.delayedCall(CFG.shieldBonus.lifetimeMs, () => {
      this.despawnShieldBonus();
      this.scheduleNextShieldBonus();
    });
  }

  pickupShieldBonus(_playerSprite, pickup) {
    if (!this.shieldPickup || pickup !== this.shieldPickup) return;

    this.clearShieldPickupTimers();
    this.shieldPickup.pulseTween?.stop();
    this.shieldPickup.rotateTween?.stop();
    this.shieldPickup.destroy();
    this.shieldPickup = null;
    playSfx(this, 'shieldPickup');
    this.tutorialShieldGot = true;

    this.activateShield(true);
    this.scheduleNextShieldBonus();
  }

  despawnShieldBonus() {
    if (!this.shieldPickup) return;
    this.clearShieldPickupTimers();
    this.shieldPickup.pulseTween?.stop();
    this.shieldPickup.rotateTween?.stop();
    this.shieldPickup.destroy();
    this.shieldPickup = null;
  }

  clearShieldPickupTimers() {
    if (this.shieldDespawnEvent) {
      this.shieldDespawnEvent.remove(false);
      this.shieldDespawnEvent = null;
    }
    if (this.shieldWarnEvent) {
      this.shieldWarnEvent.remove(false);
      this.shieldWarnEvent = null;
    }
    if (this.shieldPickupOverlap) {
      this.shieldPickupOverlap.destroy();
      this.shieldPickupOverlap = null;
    }
  }

  activateShield(fromPickup = false) {
    this.shieldActive = true;
    this.shieldFromPickup = fromPickup;
    this.shieldHitsRemaining = CFG.shieldBonus.maxHits;
    this.shieldEndsAt = this.time.now + CFG.shieldBonus.durationMs;

    if (this.shieldRing) this.shieldRing.destroy();
    const ringRadius = Math.max(18, CFG.player.radius) + CFG.shieldBonus.ringRadiusPad;
    this.shieldRing = this.add.circle(this.player.sprite.x, this.player.sprite.y, ringRadius);
    this.shieldRing.setStrokeStyle(CFG.shieldBonus.ringWidth, CFG.shieldBonus.ringColor, 0.9);
    this.shieldRing.setFillStyle();
    this.shieldHud.setVisible(true);

    this.tweens.add({
      targets: this.shieldRing,
      scale: { from: 1.8, to: 1 },
      alpha: { from: 0, to: 1 },
      duration: 260,
      ease: 'Quad.out',
    });
  }

  endShield() {
    // Reward leftover protection: the gold-star pickup shield pays coins for
    // each unused hit when it ends (the Phoenix shield does not). No payout in
    // the tutorial.
    if (!this.tutorial && this.shieldFromPickup && this.shieldHitsRemaining > 0) {
      const reward = this.shieldHitsRemaining * CFG.shieldBonus.coinsPerUnusedHit;
      this.coinsThisRun += reward;
      Save.addToWallet(reward);
      this.showFloatingText(
        this.player.sprite.x,
        this.player.sprite.y - 36,
        `SHIELD +${reward} ¢`,
        '#ffd54f',
      );
    }
    this.shieldFromPickup = false;
    this.shieldActive = false;
    this.shieldHitsRemaining = 0;
    this.shieldEndsAt = 0;
    if (this.shieldRing) {
      const ring = this.shieldRing;
      this.shieldRing = null;
      this.tweens.add({
        targets: ring,
        scale: 2.4,
        alpha: 0,
        duration: 220,
        onComplete: () => ring.destroy(),
      });
    }
    this.shieldHud.setVisible(false);
  }

  updateShield(time) {
    if (!this.shieldActive) return;
    if (this.shieldRing) {
      this.shieldRing.x = this.player.sprite.x;
      this.shieldRing.y = this.player.sprite.y;
    }
    if (time >= this.shieldEndsAt) {
      this.endShield();
    }
  }

  scheduleNextGift() {
    if (this.gameOver || this.tutorial) return;
    const base = Phaser.Math.Between(CFG.gift.spawnDelayMinMs, CFG.gift.spawnDelayMaxMs);
    const delay = base * (this.runtime.giftRateMult ?? 1);
    this.time.delayedCall(delay, () => this.spawnGift());
  }

  spawnGift() {
    if (this.gameOver) return;
    if (this.giftPickup) return;

    const pad = CFG.gift.edgePadding;
    const x = Phaser.Math.Between(pad, this.arenaW - pad);
    const y = Phaser.Math.Between(pad, this.arenaH - pad);
    const size = CFG.gift.radius * 2;

    const box = this.add.rectangle(x, y, size, size, CFG.gift.color);
    box.setStrokeStyle(3, 0xffffff, 0.9);
    this.physics.add.existing(box);
    box.body.setImmovable(true);
    // Ribbon cross (visual only) kept in sync via the shared pulse tween.
    const ribbonV = this.add.rectangle(x, y, 4, size, 0xffd54f, 0.95);
    const ribbonH = this.add.rectangle(x, y, size, 4, 0xffd54f, 0.95);
    box.ribbons = [ribbonV, ribbonH];

    box.pulseTween = this.tweens.add({
      targets: [box, ribbonV, ribbonH],
      scale: { from: 0.85, to: 1.15 },
      duration: 550,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    this.giftPickup = box;

    this.giftPickupOverlap = this.physics.add.overlap(
      this.player.sprite,
      box,
      this.pickupGift,
      null,
      this,
    );

    this.giftWarnEvent = this.time.delayedCall(CFG.gift.lifetimeMs - CFG.gift.warnLastMs, () => {
      if (!this.giftPickup) return;
      this.tweens.add({
        targets: [this.giftPickup, ...this.giftPickup.ribbons],
        alpha: { from: 1, to: 0.25 },
        duration: 180,
        yoyo: true,
        repeat: -1,
      });
    });

    this.giftDespawnEvent = this.time.delayedCall(CFG.gift.lifetimeMs, () => {
      this.despawnGift();
      this.scheduleNextGift();
    });
  }

  pickupGift(_playerSprite, pickup) {
    if (!this.giftPickup || pickup !== this.giftPickup) return;
    this.clearGiftTimers();
    this.destroyGiftPickup();
    playSfx(this, 'modGrant');
    this.tutorialGiftGot = true;
    this.grantRandomMod();
    this.scheduleNextGift();
  }

  despawnGift() {
    if (!this.giftPickup) return;
    this.clearGiftTimers();
    this.destroyGiftPickup();
  }

  destroyGiftPickup() {
    if (!this.giftPickup) return;
    this.giftPickup.pulseTween?.stop();
    (this.giftPickup.ribbons || []).forEach((r) => {
      r.destroy();
    });
    this.giftPickup.destroy();
    this.giftPickup = null;
  }

  clearGiftTimers() {
    if (this.giftDespawnEvent) {
      this.giftDespawnEvent.remove(false);
      this.giftDespawnEvent = null;
    }
    if (this.giftWarnEvent) {
      this.giftWarnEvent.remove(false);
      this.giftWarnEvent = null;
    }
    if (this.giftPickupOverlap) {
      this.giftPickupOverlap.destroy();
      this.giftPickupOverlap = null;
    }
  }

  // Grant a random mod the player is NOT already using (loadout or active gift).
  grantRandomMod() {
    const used = new Set((Save.get().loadout?.mods || []).filter(Boolean));
    if (this.tempMod) used.add(this.tempMod.id);
    // In-game gifts never grant Legendary-tier mods.
    const pool = MODS.filter((m) => !used.has(m.id) && m.tier !== 'legendary');
    if (!pool.length) {
      this.showFloatingText(this.player.sprite.x, this.player.sprite.y - 30, 'GIFT!', '#ff80ab');
      return;
    }
    const mod = pool[Phaser.Math.Between(0, pool.length - 1)];
    this.activateTempMod(mod);
  }

  activateTempMod(mod) {
    this.clearTempPhoenix();
    this.tempMod = mod;
    this.tempModEndsAt = this.time.now + CFG.gift.durationMs;
    this.computeRuntime(mod.id);
    this.player.hp = Math.min(this.player.hp, this.runtime.maxHp);
    if (mod.id === 'phoenix') {
      this.phoenixCharges += 1;
      this.tempPhoenixActive = true;
    }
    this.giftHud.setVisible(true);
    this.showFloatingText(
      this.player.sprite.x,
      this.player.sprite.y - 30,
      `+ ${mod.name}`,
      '#ff80ab',
    );
  }

  expireTempMod() {
    if (!this.tempMod) return;
    this.clearTempPhoenix();
    this.tempMod = null;
    this.tempModEndsAt = 0;
    this.computeRuntime();
    this.player.hp = Math.min(this.player.hp, this.runtime.maxHp);
    this.giftHud.setVisible(false);
  }

  clearTempPhoenix() {
    if (!this.tempPhoenixActive) return;
    this.tempPhoenixActive = false;
    if (this.phoenixCharges > 0) this.phoenixCharges -= 1;
  }

  updateTempMod(time) {
    if (!this.tempMod) return;
    if (time >= this.tempModEndsAt) this.expireTempMod();
  }

  onKeyDown(event) {
    // Tutorial: SPACE / ENTER dismisses the current explanation (or completion)
    // panel and advances the scripted lesson.
    if (
      this.tutorial &&
      this.tutorialAwaitingAck &&
      (event.key === 'Enter' || event.key === ' ' || event.code === 'Space')
    ) {
      event.preventDefault?.();
      this.acknowledgeTutorial();
      return;
    }
    if (CHEATS_ENABLED && (event.key === '`' || event.code === 'Backquote')) {
      event.preventDefault?.();
      if (this.cheatPromptActive) this.closeCheat();
      else this.openCheat();
      return;
    }
    if (!this.cheatPromptActive && (event.key === 'f' || event.key === 'F')) {
      event.preventDefault?.();
      toggleFullscreen(this);
      return;
    }
    // Pause-menu keyboard navigation (arrows / WASD up-down + Enter/Space). P/Esc
    // resume (and back-out of the settings sub-panel) are handled in update().
    if (this.paused && !this.cheatPromptActive) {
      if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        event.preventDefault?.();
        this.movePauseSelection(-1);
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        event.preventDefault?.();
        this.movePauseSelection(1);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ' || event.code === 'Space') {
        event.preventDefault?.();
        this.activatePauseSelection();
        return;
      }
    }
    if (!this.cheatPromptActive) return;
    if (event.key === 'Enter') {
      this.submitCheat();
    } else if (event.key === 'Escape') {
      this.closeCheat();
    } else if (event.key === 'Backspace') {
      if (this.cheatBuffer.length > 0) {
        this.cheatBuffer = this.cheatBuffer.slice(0, -1);
        this.refreshCheatInput();
      }
    } else if (event.key === ' ') {
      event.preventDefault?.();
      if (this.cheatBuffer.length < 24 && !this.cheatBuffer.endsWith(' ')) {
        this.cheatBuffer += ' ';
        this.refreshCheatInput();
      }
    } else if (/^[a-zA-Z0-9]$/.test(event.key) && this.cheatBuffer.length < 24) {
      this.cheatBuffer += event.key.toLowerCase();
      this.refreshCheatInput();
    }
  }

  openCheat() {
    if (!CHEATS_ENABLED) return;
    if (this.gameOver) return;
    this.cancelSlowMo();
    this.cheatPromptActive = true;
    this.cheatBuffer = '';
    this.preCheatPaused = this.paused;
    if (!this.paused) {
      this.physics.pause();
      this.time.paused = true;
    }
    this.setPauseMenuVisible(false);
    this.cheatBg.setVisible(true);
    this.cheatTitle.setVisible(true);
    this.cheatInput.setVisible(true);
    this.cheatHint.setVisible(true);
    this.refreshCheatInput();
  }

  closeCheat() {
    if (!this.cheatPromptActive) return;
    this.cheatPromptActive = false;
    this.cheatBg.setVisible(false);
    this.cheatTitle.setVisible(false);
    this.cheatInput.setVisible(false);
    this.cheatHint.setVisible(false);
    if (this.preCheatPaused) {
      this.setPauseMenuVisible(true);
    } else {
      this.physics.resume();
      this.time.paused = false;
    }
  }

  submitCheat() {
    if (!CHEATS_ENABLED) return;
    const input = this.cheatBuffer.trim().replace(/\s+/g, ' ');
    this.closeCheat();
    if (!input) return;

    if (/^\d+$/.test(input)) {
      this.jumpToWave(Number.parseInt(input, 10));
      return;
    }

    const [command, value] = input.split(' ');
    const amount = Number.parseInt(value, 10);
    if (!Number.isFinite(amount)) return;

    if (command === 'wave' || command === 'w') {
      this.jumpToWave(amount);
    } else if (command === 'coins' || command === 'coin' || command === 'c') {
      this.addCheatCoins(amount);
    }
  }

  refreshCheatInput() {
    if (!CHEATS_ENABLED || !this.cheatInput) return;
    this.cheatInput.setText(this.cheatBuffer.length ? `> ${this.cheatBuffer}` : '> _');
  }

  addCheatCoins(amount) {
    if (!CHEATS_ENABLED) return;
    const coins = Math.max(0, Math.min(999999, amount));
    if (coins <= 0) return;
    this.coinsThisRun += coins;
    Save.addToWallet(coins);
    this.showFloatingText(
      this.player.sprite.x,
      this.player.sprite.y - 44,
      `+${coins} ¢`,
      '#ffd54f',
    );
    this.updateHUD(this.time.now);
  }

  jumpToWave(n) {
    if (!CHEATS_ENABLED) return;
    this.cancelSlowMo();
    if (this.activeSpawnEvent) {
      this.activeSpawnEvent.remove(false);
      this.activeSpawnEvent = null;
    }
    if (this.nextWaveDelayedCall) {
      this.nextWaveDelayedCall.remove(false);
      this.nextWaveDelayedCall = null;
    }
    this.nextWaveScheduled = false;

    if (this.boss) this.cleanupEnemyExtras(this.boss);
    this.teardownBossState();

    this.enemies.clear(true, true);
    this.bullets.clear(true, true);
    this.enemyProjectiles.clear(true, true);
    this.hazards.clear(true, true);

    if (this.waveBanner) {
      this.waveBanner.destroy();
      this.waveBanner = null;
    }

    this.pendingSpawns = 0;
    this.beginAtWave(n);
  }

  buildStarPoints(outerR, innerR, spikes) {
    const pts = [];
    const step = Math.PI / spikes;
    let angle = -Math.PI / 2;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      pts.push(Math.cos(angle) * r, Math.sin(angle) * r);
      angle += step;
    }
    return pts;
  }

  // Draws the top-left HP indicator as discrete pips: one per runtime.maxHp,
  // filled for remaining HP and dim for lost HP. The row is rebuilt only when the
  // pip count changes (mods like Steel Plate / Glass Cannon change maxHp mid-run),
  // and the loop only runs when HP actually changes to avoid per-frame churn. A
  // pip emptied by damage gets a brief scale-and-brighten flash before going dim.
  renderHpPips() {
    const cfg = CFG.hud.hpPips;
    const total = this.runtime.maxHp;
    const current = Math.max(0, this.player.hp);
    const rebuilt = this.hpPips.length !== total;
    if (!rebuilt && current === this._lastShownHp) return;

    if (rebuilt) {
      for (const pip of this.hpPips) pip.destroy();
      this.hpPips = [];
      for (let i = 0; i < total; i++) {
        const px = this.hpPipsX + cfg.size / 2 + i * cfg.gap;
        const heart = this.add
          .image(px, cfg.y, 'hp-heart')
          .setDisplaySize(cfg.size, cfg.size)
          .setDepth(20);
        this.hpPips.push(heart);
      }
      // A rebuild (run start or maxHp change) must not flash existing pips.
      this._lastShownHp = current;
    }

    const prev = this._lastShownHp ?? current;
    for (let i = 0; i < this.hpPips.length; i++) {
      const pip = this.hpPips[i];
      if (!rebuilt && i >= current && i < prev) {
        this.flashLostPip(pip); // this heart was just emptied by damage
      } else if (i < current) {
        this.tweens.killTweensOf(pip);
        pip
          .setTexture('hp-heart')
          .setTint(cfg.fillColor)
          .setAlpha(1)
          .setDisplaySize(cfg.size, cfg.size);
      } else {
        this.tweens.killTweensOf(pip);
        pip
          .setTexture('hp-heart-empty')
          .setTint(cfg.fillColor)
          .setAlpha(1)
          .setDisplaySize(cfg.size, cfg.size);
      }
    }
    this._lastShownHp = current;
  }

  // Quick "you lost a heart" cue: brighten + scale-punch the filled heart, then
  // settle it into the empty (outline) state.
  flashLostPip(pip) {
    const cfg = CFG.hud.hpPips;
    this.tweens.killTweensOf(pip);
    pip
      .setTexture('hp-heart')
      .setTint(cfg.flashColor)
      .setAlpha(1)
      .setDisplaySize(cfg.size * 1.5, cfg.size * 1.5);
    this.tweens.add({
      targets: pip,
      displayWidth: cfg.size,
      displayHeight: cfg.size,
      duration: cfg.flashMs,
      ease: 'Quad.out',
      onComplete: () =>
        pip.setTexture('hp-heart-empty').setTint(cfg.fillColor).setDisplaySize(cfg.size, cfg.size),
    });
  }

  updateHUD(time = 0) {
    this.renderHpPips();
    this.hudScore.setText(`Score: ${this.score}`);
    this.hudWave.setText(`Wave: ${this.wave}`);
    this.hudCombo.setText(`Combo: x${this.comboMultiplier}`);
    this.hudCoins.setText(`¢ ${this.coinsThisRun}`);
    this.updateWaveProgress();

    const remaining = Math.max(0, this.player.dashReadyAt - time);
    if (remaining > 0) {
      this.dashReadyAnnounced = false;
      this.dashCdText.setText(`dash cooldown: ${(remaining / 1000).toFixed(1)}s`);
    } else {
      // Edge-trigger a "recharged" chime once, but only after an actual dash.
      if (!this.dashReadyAnnounced) {
        this.dashReadyAnnounced = true;
        if (this.player.dashReadyAt > 0) playSfx(this, 'dashReady');
      }
      this.dashCdText.setText('dash ready  [space]');
    }

    if (this.hudWeapon) {
      const name = this.weaponDef?.name || '';
      this.hudWeapon.setText(this.weapons[1] ? `${name}  [C swap]` : name);
    }

    if (this.shieldActive) {
      const secs = Math.max(0, (this.shieldEndsAt - time) / 1000).toFixed(1);
      this.shieldHud.setText(
        `\u{1F6E1} SHIELD  hits: ${this.shieldHitsRemaining}/${CFG.shieldBonus.maxHits}  ${secs}s`,
      );
    }

    if (this.tempMod) {
      const secs = Math.max(0, (this.tempModEndsAt - time) / 1000).toFixed(1);
      this.giftHud.setText(`\u{1F381} ${this.tempMod.name}  ${secs}s`);
    }
  }

  // Top-right "N left" counter + thin bar showing how much of the current normal
  // wave remains. Hidden during boss waves (the boss HP bar covers progress) and
  // in the demo/tutorial sandbox, where there is no wave progression to track.
  updateWaveProgress() {
    if (!this.waveBarFill) return;
    const show =
      !this.demo &&
      !this.tutorial &&
      !this.bossActive &&
      !this.bossSpawning &&
      this.wave > 0 &&
      !this.isBossWave(this.wave) &&
      this.waveTotalEnemies > 0;
    this.hudWaveLeft.setVisible(show);
    this.waveBarBg.setVisible(show);
    this.waveBarFill.setVisible(show);
    if (!show) return;

    const wp = CFG.hud.waveProgress;
    const remaining = Math.max(0, this.pendingSpawns + this.enemies.countActive(true));
    const frac = Phaser.Math.Clamp(remaining / this.waveTotalEnemies, 0, 1);
    this.waveBarFill.scaleX = frac;
    this.waveBarFill.setFillStyle(frac <= wp.lowFraction ? wp.lowColor : wp.fillColor);
    this.hudWaveLeft.setText(`${remaining} left`);
  }
}
