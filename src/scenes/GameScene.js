import Phaser from 'phaser';
import { CFG } from '../config.js';
import { Save } from '../save.js';
import { getWeapon, buildRuntimeStats } from '../catalog.js';

const PLAYER_DIRECTIONS = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];
const PLAYER_POSES = ['idle', 'walk1', 'walk2', 'dash', 'hit', 'death'];
const PLAYER_BODY_SCALE = 0.78;
const PLAYER_WEAPON_SCALE = 0.46;
const PLAYER_HITBOX = { width: 18, height: 26, offsetX: 23, offsetY: 28 };

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
  }

  create() {
    this.physics.world.setBounds(0, 0, CFG.arena.width, CFG.arena.height);

    const save = Save.get();
    const loadoutMods = (save.loadout?.mods || []).filter(Boolean);
    this.weaponDef = getWeapon(save.loadout?.weapon || 'pistol');
    this.modStats = buildRuntimeStats(loadoutMods);

    this.runtime = {
      maxHp: Math.max(1, CFG.player.hp + this.modStats.maxHpDelta),
      playerSpeed: CFG.player.speed * this.modStats.moveSpeedMult,
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

    this.aimAngle = 0;
    this.lastMoveDir = { x: 1, y: 0 };

    this.buffLevel = 0;
    this.bonusPickup = null;
    this.bonusDespawnEvent = null;
    this.bonusWarnEvent = null;

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

    this.createHUD();

    this.input.keyboard.on('keydown', this.onKeyDown, this);

    this.startNextWave();
    this.scheduleNextBonus();
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
    barrel.setOrigin(0.2, 0.5);
    barrel.setScale(PLAYER_WEAPON_SCALE);
    barrel.setDepth(6);

    this.player.sprite = sprite;
    this.player.barrel = barrel;
  }

  playerFrameKey(direction, pose) {
    return `player-${direction}-${pose}`;
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
        CFG.arena.height / 2,
        'PAUSED\n(press P / Esc to resume)',
        {
          ...style,
          fontSize: '28px',
          align: 'center',
        },
      )
      .setOrigin(0.5)
      .setVisible(false);

    this.dashCdText = this.add
      .text(CFG.arena.width / 2, CFG.arena.height - 18, '', {
        ...style,
        fontSize: '12px',
        color: '#888',
      })
      .setOrigin(0.5, 1);

    this.powerupText = this.add
      .text(CFG.arena.width / 2, 14, '★ POWER UP ★', {
        ...style,
        fontSize: '18px',
        color: '#69f0ae',
      })
      .setOrigin(0.5, 0)
      .setVisible(false);

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

    this.updateAim();
    this.handleMovementAndDash(time);
    this.handleFire(time);
    this.updatePlayerVisuals(time);
    this.updateEnemies();
    this.updateBullets(time);
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
    const accel = CFG.coin.magnetAccel;
    const radius = this.runtime.magnetRadius;
    const radiusSq = radius * radius;
    const maxSpeed = CFG.coin.maxSpeed;
    const dt = delta / 1000;
    this.coins.getChildren().forEach((coin) => {
      const dx = px - coin.x;
      const dy = py - coin.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radiusSq) {
        const dist = Math.sqrt(distSq) || 1;
        const ax = (dx / dist) * accel * dt;
        const ay = (dy / dist) * accel * dt;
        let vx = coin.body.velocity.x + ax;
        let vy = coin.body.velocity.y + ay;
        const sp = Math.hypot(vx, vy);
        if (sp > maxSpeed) { vx = (vx / sp) * maxSpeed; vy = (vy / sp) * maxSpeed; }
        coin.body.setVelocity(vx, vy);
      } else {
        coin.body.setVelocity(coin.body.velocity.x * 0.96, coin.body.velocity.y * 0.96);
      }
    });
  }

  updateAim() {
    const ptr = this.input.activePointer;
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    this.aimAngle = Math.atan2(ptr.worldY - py, ptr.worldX - px);
    this.player.barrel.x = px + Math.cos(this.aimAngle) * 2;
    this.player.barrel.y = py + Math.sin(this.aimAngle) * 2 + 1;
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
        this.player.dashDir.x * CFG.player.dashSpeed,
        this.player.dashDir.y * CFG.player.dashSpeed,
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

    const useBuff = this.buffLevel > 0;
    const level = CFG.bonus.levels[this.buffLevel];
    const weapon = this.weaponDef;
    const burst = weapon.fire.burst;

    // Burst weapons: pace shots independently of pointer state
    if (burst && !useBuff) {
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
    const angles = useBuff ? level.angles : weapon.fire.angles;
    for (const offsetDeg of angles) {
      this.fireBullet(time, offsetDeg);
    }
    const baseRate = useBuff ? level.fireRateMs : weapon.fire.rateMs;
    this.player.nextFireAt = time + baseRate * this.runtime.fireRateMult;
  }

  fireWeaponShot(time) {
    const useBuff = this.buffLevel > 0;
    const level = CFG.bonus.levels[this.buffLevel];
    const angles = useBuff ? level.angles : this.weaponDef.fire.angles;
    for (const offsetDeg of angles) {
      this.fireBullet(time, offsetDeg);
    }
  }

  fireBullet(time, offsetDeg = 0) {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const angle = this.aimAngle + (offsetDeg * Math.PI) / 180;
    const mods = (this.buffLevel === 0 && this.weaponDef.fire.bulletMods) || {};
    const sizeMult = mods.sizeMult || 1;
    const radius = CFG.bullet.radius * sizeMult;
    const speedMult = mods.speedMult || 1;
    const speed = this.runtime.bulletSpeed * speedMult;
    const lifetime = mods.lifetimeMsOverride
      ? mods.lifetimeMsOverride
      : this.runtime.bulletLifetimeMs;
    const color = mods.aoeRadius ? 0xff7043 : CFG.bullet.color;

    this.player.shootUntil = time + 90;
    const spawnX = px + Math.cos(angle) * 26;
    const spawnY = py + Math.sin(angle) * 26;

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
    const useDasher =
      this.wave >= CFG.dasher.appearFromWave &&
      Math.random() < CFG.dasher.spawnRatio;
    if (useDasher) this.createDasher(x, y);
    else this.createSwarmer(x, y);
    this.pendingSpawns -= 1;
    if (this.pendingSpawns <= 0) {
      this.pendingSpawns = 0;
      this.activeSpawnEvent = null;
    }
  }

  createSwarmer(x, y) {
    const enemy = this.add.circle(x, y, CFG.enemy.radius, CFG.enemy.color);
    this.physics.add.existing(enemy);
    this.enemies.add(enemy);
    enemy.body.setCircle(CFG.enemy.radius);
    enemy.body.setOffset(-CFG.enemy.radius, -CFG.enemy.radius);
    enemy.speed = this.enemySpeedThisWave;
    enemy.hp = CFG.enemy.hp;
    enemy.type = 'swarmer';
  }

  createDasher(x, y) {
    const enemy = this.add.circle(x, y, CFG.dasher.radius, CFG.dasher.color);
    this.physics.add.existing(enemy);
    this.enemies.add(enemy);
    enemy.body.setCircle(CFG.dasher.radius);
    enemy.body.setOffset(-CFG.dasher.radius, -CFG.dasher.radius);
    enemy.speed = this.enemySpeedThisWave * CFG.dasher.walkSpeedFactor;
    enemy.hp = CFG.dasher.hp;
    enemy.type = 'dasher';
    enemy.baseColor = CFG.dasher.color;
    enemy.windupEndsAt = 0;
    enemy.dashEndsAt = 0;
    enemy.nextDashAt = this.time.now + Phaser.Math.Between(
      CFG.dasher.dashCooldownMinMs,
      CFG.dasher.dashCooldownMaxMs,
    );
  }

  updateEnemies() {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const now = this.time.now;
    this.enemies.getChildren().forEach((enemy) => {
      if (enemy.type === 'dasher') {
        this.updateDasher(enemy, px, py, now);
      } else {
        const dx = px - enemy.x;
        const dy = py - enemy.y;
        const len = Math.hypot(dx, dy) || 1;
        enemy.body.setVelocity((dx / len) * enemy.speed, (dy / len) * enemy.speed);
      }
    });
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
      enemy.setFillStyle(flashOn ? 0xffffff : enemy.baseColor);
      if (now >= enemy.windupEndsAt) {
        enemy.windupEndsAt = 0;
        enemy.setFillStyle(enemy.baseColor);
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
    enemy.destroy();
    this.killEnemyScoring(ex, ey);

    if (mods.aoeRadius) {
      const r = mods.aoeRadius;
      const rSq = r * r;
      const splash = this.add.circle(ex, ey, r, 0xff7043, 0.25);
      this.tweens.add({ targets: splash, alpha: 0, scale: 1.2, duration: 200, onComplete: () => splash.destroy() });
      this.enemies.getChildren().forEach((e) => {
        const d = Phaser.Math.Distance.Squared(ex, ey, e.x, e.y);
        if (d <= rSq) {
          const ex2 = e.x, ey2 = e.y;
          e.destroy();
          this.killEnemyScoring(ex2, ey2);
        }
      });
    }

    this.maybeStartNextWave();
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
    this.updateHUD(this.time.now);
  }

  onPlayerHitEnemy(playerSprite, enemy) {
    if (this.time.now < this.player.invulnerableUntil) return;

    if (this.shieldActive) {
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

    enemy.destroy();
    this.stepDownBuff();
    this.player.hp -= CFG.enemy.contactDamage;
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
    this.player.sprite.setTexture(this.playerFrameKey(this.player.facing, 'death'));
    this.player.barrel.setVisible(false);
    this.physics.pause();
    if (this.bonusPickup) this.despawnBonus();
    if (this.shieldPickup) this.despawnShieldBonus();
    if (this.shieldActive) this.endShield();
    this.time.delayedCall(400, () => {
      this.scene.start('GameOverScene', {
        score: this.score,
        wave: this.wave,
        coinsEarned: this.coinsThisRun,
      });
    });
  }

  payWaveClearBonus() {
    if (this.wave < 1) return;
    const bonus = CFG.store.waveClearBase + CFG.store.waveClearPerWave * this.wave;
    const amount = Math.max(1, Math.round(bonus * this.runtime.coinDropMult));
    this.coinsThisRun += amount;
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
      this.pauseText.setVisible(true);
    } else {
      this.physics.resume();
      this.time.paused = false;
      this.pauseText.setVisible(false);
    }
  }

  scheduleNextBonus() {
    if (this.gameOver) return;
    const delay = Phaser.Math.Between(
      CFG.bonus.spawnDelayMinMs,
      CFG.bonus.spawnDelayMaxMs,
    );
    this.time.delayedCall(delay, () => this.spawnBonus());
  }

  spawnBonus() {
    if (this.gameOver) return;
    if (this.bonusPickup) return;

    const pad = CFG.bonus.edgePadding;
    const x = Phaser.Math.Between(pad, CFG.arena.width - pad);
    const y = Phaser.Math.Between(pad, CFG.arena.height - pad);

    const pickup = this.add.circle(x, y, CFG.bonus.radius, CFG.bonus.color);
    pickup.setStrokeStyle(2, 0xffffff, 0.7);
    this.physics.add.existing(pickup);
    pickup.body.setCircle(CFG.bonus.radius);
    pickup.body.setOffset(-CFG.bonus.radius, -CFG.bonus.radius);
    pickup.body.setImmovable(true);

    pickup.pulseTween = this.tweens.add({
      targets: pickup,
      scale: { from: 0.85, to: 1.2 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    this.bonusPickup = pickup;

    this.bonusOverlap = this.physics.add.overlap(
      this.player.sprite,
      pickup,
      this.pickupBonus,
      null,
      this,
    );

    this.bonusWarnEvent = this.time.delayedCall(
      CFG.bonus.lifetimeMs - CFG.bonus.warnLastMs,
      () => {
        if (!this.bonusPickup) return;
        this.tweens.add({
          targets: this.bonusPickup,
          alpha: { from: 1, to: 0.25 },
          duration: 180,
          yoyo: true,
          repeat: -1,
        });
      },
    );

    this.bonusDespawnEvent = this.time.delayedCall(CFG.bonus.lifetimeMs, () => {
      this.despawnBonus();
      this.scheduleNextBonus();
    });
  }

  pickupBonus(playerSprite, pickup) {
    if (!this.bonusPickup || pickup !== this.bonusPickup) return;

    this.clearBonusTimers();
    this.bonusPickup.pulseTween?.stop();
    this.bonusPickup.destroy();
    this.bonusPickup = null;

    const maxLevel = CFG.bonus.levels.length - 1;
    this.buffLevel = Math.min(this.buffLevel + 1, maxLevel);
    this.applyBuffVisuals();

    this.tweens.add({
      targets: this.player.sprite,
      scale: { from: PLAYER_BODY_SCALE * 1.25, to: PLAYER_BODY_SCALE },
      alpha: { from: 0.5, to: 1 },
      duration: 220,
      ease: 'Quad.out',
    });

    this.scheduleNextBonus();
  }

  despawnBonus() {
    if (!this.bonusPickup) return;
    this.clearBonusTimers();
    this.bonusPickup.pulseTween?.stop();
    this.bonusPickup.destroy();
    this.bonusPickup = null;
  }

  clearBonusTimers() {
    if (this.bonusDespawnEvent) {
      this.bonusDespawnEvent.remove(false);
      this.bonusDespawnEvent = null;
    }
    if (this.bonusWarnEvent) {
      this.bonusWarnEvent.remove(false);
      this.bonusWarnEvent = null;
    }
    if (this.bonusOverlap) {
      this.bonusOverlap.destroy();
      this.bonusOverlap = null;
    }
  }

  stepDownBuff() {
    if (this.buffLevel === 0) return;
    this.buffLevel -= 1;
    this.applyBuffVisuals();
  }

  applyBuffVisuals() {
    const level = CFG.bonus.levels[this.buffLevel];
    if (this.buffLevel > 0) this.player.barrel.setTint(level.barrelColor);
    else this.player.barrel.clearTint();
    if (this.buffLevel > 0) {
      this.powerupText.setText(`★ ${level.label} ★`);
      this.powerupText.setVisible(true);
    } else {
      this.powerupText.setVisible(false);
    }
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
    this.pauseText.setVisible(false);
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
      this.pauseText.setVisible(true);
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

    if (this.shieldActive) {
      const secs = Math.max(0, (this.shieldEndsAt - time) / 1000).toFixed(1);
      this.shieldHud.setText(
        `\u{1F6E1} SHIELD  hits: ${this.shieldHitsRemaining}/${CFG.shieldBonus.maxHits}  ${secs}s`,
      );
    }
  }
}
