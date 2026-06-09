import Phaser from 'phaser';
import { CFG } from '../config.js';
import { Save } from '../save.js';
import { getWeapon, buildRuntimeStats } from '../catalog.js';
import { ARENA_BACKGROUNDS, backgroundKey, backgroundPath, resolveBackground } from '../backgrounds.js';
import { ENEMY_SPRITES } from '../enemies.js';
import { playSfx, preloadMusic, preloadSfx, syncMusic } from '../audio.js';

const PLAYER_DIRECTIONS = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];
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
const ENEMY_TYPE_ORDER = ['sniper', 'teleporter', 'shielded', 'summoner', 'healer', 'slime', 'egg', 'bomber', 'splitter', 'tank', 'firecaster', 'dasher'];

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    for (const direction of PLAYER_DIRECTIONS) {
      for (const pose of PLAYER_POSES) {
        const key = this.playerFrameKey(direction, pose);
        if (!this.textures.exists(key)) {
          this.load.image(key, `/assets/player/body/${direction}-${pose}.png`);
        }
      }
    }
    if (!this.textures.exists('player-rifle')) {
      this.load.image('player-rifle', '/assets/player/rifle.png');
    }
    for (const background of ARENA_BACKGROUNDS) {
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
    preloadMusic(this);
    preloadSfx(this);
  }

  create() {
    syncMusic(this);
    this.physics.world.setBounds(0, 0, CFG.arena.width, CFG.arena.height);

    const save = Save.get();
    const selectedBackground = resolveBackground(save.settings?.backgroundId);
    this.add.image(0, 0, backgroundKey(selectedBackground.id)).setOrigin(0).setDepth(-20);
    const loadoutMods = (save.loadout?.mods || []).filter(Boolean);
    const weaponIds = save.loadout?.weapons || [save.loadout?.weapon || 'pistol', null];
    this.weapons = [
      getWeapon(weaponIds[0] || 'pistol'),
      weaponIds[1] ? getWeapon(weaponIds[1]) : null,
    ];
    this.activeWeaponIndex = 0;
    this.weaponDef = this.weapons[0];
    this.modStats = buildRuntimeStats(loadoutMods);

    this.runtime = {
      maxHp: Math.max(1, CFG.player.hp + this.modStats.maxHpDelta),
      playerSpeed: CFG.player.speed * this.modStats.moveSpeedMult,
      dashSpeed: CFG.player.dashSpeed * this.modStats.dashSpeedMult,
      dashCooldownMs: CFG.player.dashCooldownMs * this.modStats.dashCooldownMult,
      bulletSpeed: CFG.bullet.speed * this.modStats.bulletSpeedMult,
      bulletLifetimeMs: CFG.bullet.lifetimeMs * this.modStats.bulletLifetimeMult,
      fireRateMult: this.modStats.fireRateMult,
      coinDropMult: this.modStats.coinDropMult,
      magnetRadius: CFG.coin.magnetRadius * this.modStats.magnetRangeMult,
      comboResetMs: CFG.combo.resetMs + this.modStats.comboResetMsDelta,
      luckyChance: this.modStats.luckyChance,
    };
    this.phoenixCharges = this.modStats.phoenixCharges;

    this.score = 0;
    this.wave = 0;
    this.comboMultiplier = 1;
    this.lastKillAt = 0;
    this.enemySpeedThisWave = CFG.enemy.speed;
    this.pendingSpawns = 0;
    this.paused = false;
    this.gameOver = false;

    this.coinsThisRun = 0;
    this.burstShotsRemaining = 0;
    this.burstNextAt = 0;
    this.lastLaserSfxAt = -Infinity;

    this.aimAngle = 0;
    this.lastMoveDir = { x: 1, y: 0 };

    this.shieldActive = false;
    this.shieldHitsRemaining = 0;
    this.shieldEndsAt = 0;
    this.shieldRing = null;
    this.shieldPickup = null;
    this.shieldDespawnEvent = null;
    this.shieldWarnEvent = null;
    this.shieldPickupOverlap = null;

    this.cheatPromptActive = false;
    this.cheatBuffer = '';
    this.preCheatPaused = false;
    this.activeSpawnEvent = null;
    this.nextWaveDelayedCall = null;

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

    this.physics.add.overlap(
      this.player.sprite,
      this.coins,
      this.onPlayerCoin,
      null,
      this,
    );

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

    this.physics.add.overlap(
      this.bullets,
      this.enemies,
      this.onBulletHitEnemy,
      null,
      this,
    );
    this.physics.add.overlap(
      this.player.sprite,
      this.enemies,
      this.onPlayerHitEnemy,
      null,
      this,
    );
    this.physics.add.overlap(
      this.player.sprite,
      this.enemyProjectiles,
      this.onPlayerHitEnemyProjectile,
      null,
      this,
    );
    this.physics.add.overlap(
      this.player.sprite,
      this.hazards,
      this.onPlayerHitHazard,
      null,
      this,
    );

    this.createEnemyAnimations();
    this.createBoomerangTexture();
    this.createHUD();

    this.input.keyboard.on('keydown', this.onKeyDown, this);
    this.input.on('pointerdown', this.onPointerDown, this);

    this.startNextWave();
    this.scheduleNextShieldBonus();
  }

  spawnPlayer() {
    const cx = CFG.arena.width / 2;
    const cy = CFG.arena.height / 2;

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
          frames: this.anims.generateFrameNumbers(sprite.key, { start: 0, end: 3 }),
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
      { x: 4, y: 7 }, { x: 16, y: 15 }, { x: 28, y: 7 },
      { x: 25, y: 13 }, { x: 16, y: 22 }, { x: 7, y: 13 },
    ];
    g.fillStyle(0x29b6f6, 1);
    g.fillPoints(points, true);
    g.lineStyle(2, 0xe1f5fe, 1);
    g.strokePoints(points, true);
    g.generateTexture('boomerang-bullet', 32, 32);
    g.destroy();
  }

  onPointerDown() {
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
    this.hudHp = this.add.text(10, 8, '', style);
    this.hudScore = this.add.text(10, 28, '', style);
    this.hudWave = this.add.text(CFG.arena.width - 10, 8, '', style).setOrigin(1, 0);
    this.hudCombo = this.add.text(CFG.arena.width - 10, 28, '', style).setOrigin(1, 0);
    this.hudCoins = this.add
      .text(CFG.arena.width / 2, 8, '', { ...style, color: '#ffd54f' })
      .setOrigin(0.5, 0);

    this.pauseText = this.add
      .text(
        CFG.arena.width / 2,
        CFG.arena.height / 2 - 34,
        'PAUSED\nP / Esc resume',
        {
          ...style,
          fontSize: '28px',
          align: 'center',
        },
      )
      .setOrigin(0.5)
      .setVisible(false);
    this.pauseExitButton = this.add
      .text(CFG.arena.width / 2, CFG.arena.height / 2 + 78, 'EXIT TO MENU   [M]', {
        ...style,
        fontSize: '20px',
        color: '#ffd54f',
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.exitToMainMenu())
      .on('pointerover', () => this.pauseExitButton.setColor('#ffffff'))
      .on('pointerout', () => this.pauseExitButton.setColor('#ffd54f'));
    this.pauseExitButton.disableInteractive();

    this.dashCdText = this.add
      .text(CFG.arena.width / 2, CFG.arena.height - 18, '', {
        ...style,
        fontSize: '12px',
        color: '#ffd54f',
      })
      .setOrigin(0.5, 1);

    this.hudWeapon = this.add
      .text(10, CFG.arena.height - 8, '', {
        ...style,
        fontSize: '12px',
        color: '#bbbbbb',
      })
      .setOrigin(0, 1);

    this.shieldHud = this.add
      .text(CFG.arena.width / 2, 38, '', {
        ...style,
        fontSize: '14px',
        color: '#ffd54f',
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

    this.cheatBg = this.add
      .rectangle(
        CFG.arena.width / 2,
        CFG.arena.height / 2,
        460,
        180,
        0x000000,
        0.85,
      )
      .setStrokeStyle(2, 0xffd54f)
      .setVisible(false);
    this.cheatTitle = this.add
      .text(CFG.arena.width / 2, CFG.arena.height / 2 - 52, 'CHEAT CONSOLE', {
        ...style,
        fontSize: '22px',
        color: '#ffd54f',
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.cheatInput = this.add
      .text(CFG.arena.width / 2, CFG.arena.height / 2, '_', {
        ...style,
        fontSize: '24px',
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.cheatHint = this.add
      .text(
        CFG.arena.width / 2,
        CFG.arena.height / 2 + 52,
        'wave 10  ·  coins 500  ·  enter confirm  ·  esc cancel',
        { ...style, fontSize: '12px', color: '#999' },
      )
      .setOrigin(0.5)
      .setVisible(false);

    this.updateHUD();
  }

  update(time, delta) {
    if (this.gameOver) return;
    if (this.cheatPromptActive) return;

    if (
      Phaser.Input.Keyboard.JustDown(this.keys.pauseP) ||
      Phaser.Input.Keyboard.JustDown(this.keys.pauseEsc)
    ) {
      this.togglePause();
    }

    if (this.paused) return;

    if (Phaser.Input.Keyboard.JustDown(this.keys.switchWeapon)) {
      this.switchWeapon(time);
    }

    this.updateAim();
    this.handleMovementAndDash(time);
    this.handleFire(time);
    this.updatePlayerVisuals(time);
    this.updateEnemies();
    this.updateBullets(time);
    this.updateEnemyProjectiles(time);
    this.updateHazards(time);
    this.updateCoins(time, delta);
    this.despawnExpiredBullets(time);
    this.maybeDecayCombo(time);
    this.updateShield(time);
    this.maybeStartNextWave();
    this.updateHUD(time);
  }

  updateBullets(time) {
    this.bullets.getChildren().forEach((bullet) => {
      const mods = bullet.bulletMods;
      if (!mods) return;
      if (bullet.isBoomerang) {
        if (bullet.recalled) {
          const px = this.player.sprite.x;
          const py = this.player.sprite.y;
          const dx = px - bullet.x;
          const dy = py - bullet.y;
          const dist = Math.hypot(dx, dy) || 1;
          const recallSpeed = bullet.bulletSpeed * 1.9;
          bullet.body.setVelocity((dx / dist) * recallSpeed, (dy / dist) * recallSpeed);
          if (dist < 20) { bullet.destroy(); return; }
        } else if (mods.returningAfterMs && !bullet.bulletReturned
          && time - bullet.bulletBornAt >= mods.returningAfterMs) {
          bullet.bulletReturned = true;
          bullet.body.setVelocity(-bullet.body.velocity.x, -bullet.body.velocity.y);
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
      if (d < bestD) { bestD = d; best = e; }
    });
    return best;
  }

  updateCoins(time, delta) {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const magnetRadius = this.runtime.magnetRadius;
    const gravityRadius = magnetRadius * CFG.coin.gravityRadiusMult;
    const magnetRadiusSq = magnetRadius * magnetRadius;
    const gravityRadiusSq = gravityRadius * gravityRadius;
    const maxSpeed = CFG.coin.maxSpeed;
    this.coins.getChildren().forEach((coin) => {
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
        if (sp > maxSpeed) { vx = (vx / sp) * maxSpeed; vy = (vy / sp) * maxSpeed; }
        coin.body.setVelocity(vx, vy);
      } else {
        coin.body.setVelocity(coin.body.velocity.x * CFG.coin.drag, coin.body.velocity.y * CFG.coin.drag);
      }
    });
  }

  updateAim() {
    const ptr = this.input.activePointer;
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    this.aimAngle = Math.atan2(ptr.worldY - py, ptr.worldX - px);
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
    const k = this.keys;
    const c = this.cursors;
    const left = k.left.isDown || c.left.isDown;
    const right = k.right.isDown || c.right.isDown;
    const up = k.up.isDown || c.up.isDown;
    const down = k.down.isDown || c.down.isDown;

    let vx = (right ? 1 : 0) - (left ? 1 : 0);
    let vy = (down ? 1 : 0) - (up ? 1 : 0);

    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      vx /= len;
      vy /= len;
      this.lastMoveDir = { x: vx, y: vy };
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.dash)) {
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
    if (!this.input.activePointer.isDown && this.burstShotsRemaining === 0) return;

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
      if (!this.input.activePointer.isDown) return;
      if (time < this.player.nextFireAt) return;
      this.burstShotsRemaining = burst.count;
      this.burstNextAt = time;
      return;
    }

    if (time < this.player.nextFireAt) return;

    const weaponMods = weapon.fire.bulletMods;
    if (weaponMods && weaponMods.hitscan) {
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
    const reach = CFG.arena.width + CFG.arena.height;
    const ex = px + dirX * reach;
    const ey = py + dirY * reach;

    this.player.shootUntil = time + 90;

    const pad = CFG.bullet.radius + 4;
    const targets = this.enemies.getChildren().slice();
    for (const enemy of targets) {
      if (!enemy.active) continue;
      const r = (enemy.body && enemy.body.radius ? enemy.body.radius : 12) + pad;
      if (this.pointToSegmentDistance(enemy.x, enemy.y, px, py, ex, ey) <= r) {
        this.damageEnemy(enemy, px, py, 1);
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
    this.burstShotsRemaining = 0;
    this.player.nextFireAt = time;
    this.showFloatingText(this.player.sprite.x, this.player.sprite.y - 30, this.weaponDef.name, '#4fc3f7');
    this.updateHUD(time);
  }

  playWeaponSfx(time) {
    if (!['beam', 'plasma'].includes(this.weaponDef.id)) return;
    if (time - this.lastLaserSfxAt < 120) return;
    this.lastLaserSfxAt = time;
    playSfx(this, 'laser', this.weaponDef.id === 'beam' ? 0.45 : 0.8);
  }

  fireBullet(time, offsetDeg = 0) {
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
    const color = mods.aoeRadius ? 0xff7043 : CFG.bullet.color;

    this.player.shootUntil = time + 90;
    const spawnX = px + Math.cos(angle) * PLAYER_BULLET_OFFSET;
    const spawnY = py + Math.sin(angle) * PLAYER_BULLET_OFFSET;

    const bullet = this.add.circle(spawnX, spawnY, radius, color);
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
      bullet.once('destroy', () => { if (bullet.visual) bullet.visual.destroy(); });
    }
  }

  despawnExpiredBullets(time) {
    this.bullets.getChildren().forEach((bullet) => {
      if (
        time >= bullet.expiresAt ||
        bullet.x < -20 ||
        bullet.x > CFG.arena.width + 20 ||
        bullet.y < -20 ||
        bullet.y > CFG.arena.height + 20
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
        projectile.x > CFG.arena.width + 30 ||
        projectile.y < -30 ||
        projectile.y > CFG.arena.height + 30
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
    if (side === 0) return { x: Phaser.Math.Between(0, CFG.arena.width), y: -margin };
    if (side === 1) return { x: CFG.arena.width + margin, y: Phaser.Math.Between(0, CFG.arena.height) };
    if (side === 2) return { x: Phaser.Math.Between(0, CFG.arena.width), y: CFG.arena.height + margin };
    return { x: -margin, y: Phaser.Math.Between(0, CFG.arena.height) };
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
    const enemy = this.createEnemySprite(x, y, 'monster', CFG.dasher, DASHER_MONSTER_SCALE, CFG.dasher.color);
    enemy.speed = this.enemySpeedThisWave * CFG.dasher.walkSpeedFactor;
    enemy.hp = CFG.dasher.hp;
    enemy.maxHp = CFG.dasher.hp;
    enemy.type = 'dasher';
    enemy.baseTint = CFG.dasher.color;
    enemy.windupEndsAt = 0;
    enemy.dashEndsAt = 0;
    enemy.nextDashAt = this.time.now + Phaser.Math.Between(
      CFG.dasher.dashCooldownMinMs,
      CFG.dasher.dashCooldownMaxMs,
    );
  }

  createFirecaster(x, y) {
    const enemy = this.createEnemySprite(x, y, 'firecaster', CFG.firecaster, FIRECASTER_SCALE);
    enemy.speed = CFG.firecaster.speed + CFG.waves.enemySpeedGrowth * Math.max(0, this.wave - 1) * 0.45;
    enemy.hp = CFG.firecaster.hp;
    enemy.maxHp = CFG.firecaster.hp;
    enemy.type = 'firecaster';
    enemy.baseTint = 0xffffff;
    enemy.windupEndsAt = 0;
    enemy.nextFireAt = this.time.now + Phaser.Math.Between(
      CFG.firecaster.fireCooldownMinMs,
      CFG.firecaster.fireCooldownMaxMs,
    );
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
    const enemy = this.createEnemySprite(x, y, 'splitter', {
      radius: CFG.splitter.childRadius,
    }, 0.38);
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
    const sx = Phaser.Math.Clamp(x, pad, CFG.arena.width - pad);
    const sy = Phaser.Math.Clamp(y, pad, CFG.arena.height - pad);
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

  updateEnemies() {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const now = this.time.now;
    this.enemies.getChildren().forEach((enemy) => {
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
      enemy.nextDashAt = now + Phaser.Math.Between(
        CFG.dasher.dashCooldownMinMs,
        CFG.dasher.dashCooldownMaxMs,
      );
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
      const flashOn = Math.floor((enemy.windupEndsAt - now) / CFG.firecaster.windupFlashMs) % 2 === 0;
      enemy.setTint(flashOn ? 0xfff176 : 0xff7043);
      if (now >= enemy.windupEndsAt) {
        enemy.windupEndsAt = 0;
        enemy.clearTint();
        this.fireEnemyFireball(enemy, nx, ny, now);
        enemy.nextFireAt = now + Phaser.Math.Between(
          CFG.firecaster.fireCooldownMinMs,
          CFG.firecaster.fireCooldownMaxMs,
        );
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
        this.explodeEnemy(enemy.x, enemy.y, CFG.bomber.explosionRadius, true);
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
      if (target === enemy || target.hp >= target.maxHp) return;
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
      const ring = this.add.circle(enemy.x, enemy.y, CFG.healer.healRadius, 0x69f0ae, 0.12).setDepth(3.5);
      this.tweens.add({ targets: ring, alpha: 0, scale: 1.1, duration: 300, onComplete: () => ring.destroy() });
    }
  }

  updateSummoner(enemy, px, py, now) {
    this.keepRange(enemy, px, py, CFG.summoner.minRange, CFG.summoner.minRange + 110, enemy.speed);
    if (now < enemy.nextSummonAt) return;
    enemy.nextSummonAt = now + CFG.summoner.summonCooldownMs;
    for (let i = 0; i < CFG.summoner.summonCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.createSplitterChild(
        enemy.x + Math.cos(angle) * 26,
        enemy.y + Math.sin(angle) * 26,
      );
    }
    const flash = this.add.circle(enemy.x, enemy.y, 44, 0xab47bc, 0.18).setDepth(3.5);
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.35, duration: 360, onComplete: () => flash.destroy() });
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
        const dist = Phaser.Math.Between(CFG.teleporter.blinkMinDistance, CFG.teleporter.blinkMaxDistance);
        enemy.x = Phaser.Math.Clamp(px + Math.cos(angle) * dist, 32, CFG.arena.width - 32);
        enemy.y = Phaser.Math.Clamp(py + Math.sin(angle) * dist, 32, CFG.arena.height - 32);
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
    const { dx, dy, len, nx, ny } = this.keepRange(enemy, px, py, CFG.sniper.minRange, CFG.sniper.maxRange, enemy.speed);
    if (enemy.aimEndsAt > 0) {
      enemy.body.setVelocity(0, 0);
      if (enemy.aimLine) {
        enemy.aimLine.clear();
        enemy.aimLine.lineStyle(2, 0xff1744, 0.65);
        enemy.aimLine.lineBetween(enemy.x, enemy.y, enemy.x + enemy.aimDir.x * 900, enemy.y + enemy.aimDir.y * 900);
      }
      if (now >= enemy.aimEndsAt) {
        this.fireEnemyShot(enemy, enemy.aimDir.x, enemy.aimDir.y, now, CFG.sniper.shotRadius, 0xff1744, 0xffebee, CFG.sniper.shotSpeed, CFG.sniper.shotLifetimeMs, CFG.sniper.shotDamage);
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
    this.time.delayedCall(160, () => { if (enemy.active) this.applyDamageTint(enemy); });
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

  explodeEnemy(x, y, radius, damagesPlayer) {
    const blast = this.add.circle(x, y, radius, 0xff7043, 0.28).setDepth(4.2);
    this.tweens.add({ targets: blast, alpha: 0, scale: 1.2, duration: 260, onComplete: () => blast.destroy() });
    if (damagesPlayer) {
      const d = Phaser.Math.Distance.Between(x, y, this.player.sprite.x, this.player.sprite.y);
      if (d <= radius) this.damagePlayer(CFG.bomber.explosionDamage);
    }
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

  startNextWave() {
    this.wave += 1;
    const n = this.wave;
    const count = CFG.waves.baseCount + CFG.waves.growthPerWave * (n - 1);
    this.enemySpeedThisWave =
      CFG.enemy.speed + CFG.waves.enemySpeedGrowth * (n - 1);
    this.pendingSpawns = count;

    this.activeSpawnEvent = this.time.addEvent({
      delay: CFG.waves.spawnIntervalMs,
      repeat: count - 1,
      callback: () => this.spawnEnemy(),
    });

    if (this.waveBanner) this.waveBanner.destroy();
    this.waveBanner = this.add
      .text(CFG.arena.width / 2, 60, `WAVE ${n}`, {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '32px',
        color: '#ffffff',
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

  maybeStartNextWave() {
    if (this.gameOver) return;
    if (this.pendingSpawns > 0) return;
    if (this.enemies.countActive(true) > 0) return;
    if (this.nextWaveScheduled) return;

    this.payWaveClearBonus();

    this.nextWaveScheduled = true;
    this.nextWaveDelayedCall = this.time.delayedCall(
      CFG.waves.interWaveDelayMs,
      () => {
        this.nextWaveScheduled = false;
        this.nextWaveDelayedCall = null;
        this.startNextWave();
      },
    );
  }

  onBulletHitEnemy(bullet, enemy) {
    const mods = bullet.bulletMods || {};
    if (!mods.piercing) {
      bullet.destroy();
    }
    const ex = enemy.x;
    const ey = enemy.y;
    const damage = this.damageEnemy(enemy, bullet.x, bullet.y, 1);
    if (damage <= 0) return;

    if (mods.aoeRadius) {
      const r = mods.aoeRadius;
      const rSq = r * r;
      const splash = this.add.circle(ex, ey, r, 0xff7043, 0.25);
      this.tweens.add({ targets: splash, alpha: 0, scale: 1.2, duration: 200, onComplete: () => splash.destroy() });
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
      const c = Phaser.Display.Color.Interpolate.RGBWithRGB(255, 255, 255, 140, 50, 40, 100, Math.round(t * 100));
      enemy.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      return;
    }
    if (enemy.type === 'dasher') { enemy.setTint(enemy.baseTint); return; }
    enemy.clearTint();
  }

  cleanupEnemyExtras(enemy) {
    if (enemy.shieldMark) enemy.shieldMark.destroy();
    if (enemy.aimLine) enemy.aimLine.destroy();
  }

  onEnemyKilled(type, x, y) {
    this.killEnemyScoring(x, y);
    if (type === 'splitter') {
      for (let i = 0; i < CFG.splitter.childCount; i++) {
        const angle = (Math.PI * 2 * i) / CFG.splitter.childCount;
        this.createSplitterChild(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18);
      }
    } else if (type === 'bomber') {
      this.explodeEnemy(x, y, CFG.bomber.explosionRadius, true);
    }
  }

  killEnemyScoring(x, y) {
    this.comboMultiplier = Math.min(
      this.comboMultiplier + 1,
      CFG.combo.maxMultiplier,
    );
    this.lastKillAt = this.time.now;
    this.score += CFG.combo.scorePerKillBase * this.comboMultiplier;
    this.dropCoinsForKill(x, y);
  }

  dropCoinsForKill(x, y) {
    const base = CFG.store.coinDropPerKillBase + (this.comboMultiplier - 1);
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
    }
  }

  onPlayerCoin(playerSprite, coin) {
    coin.destroy();
    this.coinsThisRun += 1;
    Save.addToWallet(1);
    playSfx(this, 'coin');
    this.updateHUD(this.time.now);
  }

  onPlayerHitEnemy(playerSprite, enemy) {
    if (this.time.now < this.player.invulnerableUntil) return;

    if (this.shieldActive) {
      this.cleanupEnemyExtras(enemy);
      enemy.destroy();
      this.shieldHitsRemaining -= 1;
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

    this.cleanupEnemyExtras(enemy);
    enemy.destroy();
    this.player.hp -= this.getEnemyContactDamage(enemy.type);
    this.comboMultiplier = 1;
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
        this.activateShield();
        this.showFloatingText(this.player.sprite.x, this.player.sprite.y - 30, 'PHOENIX', '#ffd54f');
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

  onPlayerHitEnemyProjectile(playerSprite, projectile) {
    projectile.destroy();
    this.damagePlayer(projectile.damage || CFG.enemyFireball.damage);
  }

  onPlayerHitHazard(playerSprite, hazard) {
    if (this.time.now < hazard.nextDamageAt) return;
    hazard.nextDamageAt = this.time.now + 650;
    this.damagePlayer(hazard.damage || 1);
  }

  damagePlayer(amount) {
    if (this.time.now < this.player.invulnerableUntil) return;

    if (this.shieldActive) {
      this.shieldHitsRemaining -= 1;
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
    this.comboMultiplier = 1;
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
        this.activateShield();
        this.showFloatingText(this.player.sprite.x, this.player.sprite.y - 30, 'PHOENIX', '#ffd54f');
      } else {
        this.endGame();
      }
    }
  }

  showFloatingText(x, y, text, color = '#ffffff') {
    const t = this.add.text(x, y, text, {
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
      fontSize: '16px',
      color,
    }).setOrigin(0.5);
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
    playSfx(this, 'lose');
    this.player.sprite.setTexture(this.playerFrameKey(this.player.facing, 'death'));
    this.player.barrel.setVisible(false);
    this.physics.pause();
    if (this.shieldPickup) this.despawnShieldBonus();
    if (this.shieldActive) this.endShield();
    const saved = Save.recordRun({
      wave: this.wave,
      score: this.score,
      coinsEarned: this.coinsThisRun,
      persistCoins: false,
    });
    this.time.delayedCall(400, () => {
      this.scene.start('MainMenuScene', {
        gameOver: true,
        score: this.score,
        wave: this.wave,
        coinsEarned: this.coinsThisRun,
        walletSaved: saved.wallet,
      });
    });
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
    if (
      this.comboMultiplier > 1 &&
      time - this.lastKillAt > this.runtime.comboResetMs
    ) {
      this.comboMultiplier = 1;
    }
  }

  togglePause() {
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

  setPauseMenuVisible(visible) {
    this.pauseText.setVisible(visible);
    this.pauseExitButton.setVisible(visible);
    if (visible) {
      this.pauseExitButton.setInteractive({ useHandCursor: true });
    } else {
      this.pauseExitButton.disableInteractive();
    }
  }

  exitToMainMenu() {
    if (this.gameOver) return;
    this.input.setDefaultCursor('default');
    this.paused = false;
    this.cheatPromptActive = false;
    this.physics.resume();
    this.time.paused = false;
    // Record the run on exit just like death does. Coins are already credited
    // to the wallet live during play, so persistCoins is false to avoid
    // double-counting; this still saves stats and the lifetime coin total.
    Save.recordRun({
      wave: this.wave,
      score: this.score,
      coinsEarned: this.coinsThisRun,
      persistCoins: false,
    });
    this.scene.start('MainMenuScene');
  }

  scheduleNextShieldBonus() {
    if (this.gameOver) return;
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
    const x = Phaser.Math.Between(pad, CFG.arena.width - pad);
    const y = Phaser.Math.Between(pad, CFG.arena.height - pad);

    const points = this.buildStarPoints(
      CFG.shieldBonus.outerRadius,
      CFG.shieldBonus.innerRadius,
      5,
    );
    const star = this.add.polygon(x, y, points, CFG.shieldBonus.color);
    star.setStrokeStyle(2, 0xffffff, 0.8);
    this.physics.add.existing(star);
    star.body.setCircle(CFG.shieldBonus.outerRadius);
    star.body.setOffset(-CFG.shieldBonus.outerRadius, -CFG.shieldBonus.outerRadius);
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

  pickupShieldBonus(playerSprite, pickup) {
    if (!this.shieldPickup || pickup !== this.shieldPickup) return;

    this.clearShieldPickupTimers();
    this.shieldPickup.pulseTween?.stop();
    this.shieldPickup.rotateTween?.stop();
    this.shieldPickup.destroy();
    this.shieldPickup = null;
    playSfx(this, 'gift');

    this.activateShield();
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

  activateShield() {
    this.shieldActive = true;
    this.shieldHitsRemaining = CFG.shieldBonus.maxHits;
    this.shieldEndsAt = this.time.now + CFG.shieldBonus.durationMs;

    if (this.shieldRing) this.shieldRing.destroy();
    const ringRadius = Math.max(18, CFG.player.radius) + CFG.shieldBonus.ringRadiusPad;
    this.shieldRing = this.add.circle(
      this.player.sprite.x,
      this.player.sprite.y,
      ringRadius,
    );
    this.shieldRing.setStrokeStyle(
      CFG.shieldBonus.ringWidth,
      CFG.shieldBonus.ringColor,
      0.9,
    );
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

  onKeyDown(event) {
    if (event.key === '`' || event.code === 'Backquote') {
      event.preventDefault?.();
      if (this.cheatPromptActive) this.closeCheat();
      else this.openCheat();
      return;
    }
    if (this.paused && !this.cheatPromptActive && (event.key === 'm' || event.key === 'M')) {
      event.preventDefault?.();
      this.exitToMainMenu();
      return;
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
    if (this.gameOver) return;
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
    this.cheatInput.setText(this.cheatBuffer.length ? `> ${this.cheatBuffer}` : '> _');
  }

  addCheatCoins(amount) {
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
    if (this.activeSpawnEvent) {
      this.activeSpawnEvent.remove(false);
      this.activeSpawnEvent = null;
    }
    if (this.nextWaveDelayedCall) {
      this.nextWaveDelayedCall.remove(false);
      this.nextWaveDelayedCall = null;
    }
    this.nextWaveScheduled = false;

    this.enemies.clear(true, true);
    this.bullets.clear(true, true);
    this.enemyProjectiles.clear(true, true);
    this.hazards.clear(true, true);

    if (this.waveBanner) {
      this.waveBanner.destroy();
      this.waveBanner = null;
    }

    this.pendingSpawns = 0;
    this.wave = n - 1;
    this.startNextWave();
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

  updateHUD(time = 0) {
    this.hudHp.setText(`HP: ${Math.max(0, this.player.hp)}/${this.runtime.maxHp}`);
    this.hudScore.setText(`Score: ${this.score}`);
    this.hudWave.setText(`Wave: ${this.wave}`);
    this.hudCombo.setText(`Combo: x${this.comboMultiplier}`);
    this.hudCoins.setText(`¢ ${this.coinsThisRun}`);

    const remaining = Math.max(0, this.player.dashReadyAt - time);
    if (remaining > 0) {
      this.dashCdText.setText(`dash cooldown: ${(remaining / 1000).toFixed(1)}s`);
    } else {
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
  }
}
