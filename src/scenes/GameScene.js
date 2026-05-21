import Phaser from 'phaser';
import { CFG } from '../config.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.physics.world.setBounds(0, 0, CFG.arena.width, CFG.arena.height);

    this.score = 0;
    this.wave = 0;
    this.comboMultiplier = 1;
    this.lastKillAt = 0;
    this.enemySpeedThisWave = CFG.enemy.speed;
    this.pendingSpawns = 0;
    this.paused = false;
    this.gameOver = false;

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

    this.player = {
      sprite: null,
      barrel: null,
      hp: CFG.player.hp,
      nextFireAt: 0,
      dashEndsAt: 0,
      dashReadyAt: 0,
      invulnerableUntil: 0,
      dashDir: { x: 0, y: 0 },
    };

    this.spawnPlayer();

    this.bullets = this.physics.add.group();
    this.enemies = this.physics.add.group();

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
    this.startNextWave();
    this.scheduleNextBonus();
    this.scheduleNextShieldBonus();
  }

  spawnPlayer() {
    const cx = CFG.arena.width / 2;
    const cy = CFG.arena.height / 2;

    const sprite = this.add.circle(cx, cy, CFG.player.radius, CFG.player.color);
    this.physics.add.existing(sprite);
    sprite.body.setCollideWorldBounds(true);
    sprite.body.setCircle(CFG.player.radius);
    sprite.body.setOffset(-CFG.player.radius, -CFG.player.radius);

    const barrel = this.add.rectangle(
      cx + CFG.player.radius,
      cy,
      10,
      4,
      0xffffff,
    );
    barrel.setOrigin(0, 0.5);

    this.player.sprite = sprite;
    this.player.barrel = barrel;
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

    this.updateHUD();
  }

  update(time, delta) {
    if (this.gameOver) return;

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
    this.updateEnemies();
    this.despawnExpiredBullets(time);
    this.maybeDecayCombo(time);
    this.updateShield(time);
    this.updateHUD(time);
  }

  updateAim() {
    const ptr = this.input.activePointer;
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    this.aimAngle = Math.atan2(ptr.worldY - py, ptr.worldX - px);
    this.player.barrel.x = px;
    this.player.barrel.y = py;
    this.player.barrel.rotation = this.aimAngle;
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
      body.setVelocity(vx * CFG.player.speed, vy * CFG.player.speed);
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
    this.player.dashReadyAt = time + CFG.player.dashCooldownMs;
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
    if (!this.input.activePointer.isDown) return;
    if (time < this.player.nextFireAt) return;
    const level = CFG.bonus.levels[this.buffLevel];
    for (const offsetDeg of level.angles) {
      this.fireBullet(time, offsetDeg);
    }
    this.player.nextFireAt = time + level.fireRateMs;
  }

  fireBullet(time, offsetDeg = 0) {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const angle = this.aimAngle + (offsetDeg * Math.PI) / 180;
    const spawnX = px + Math.cos(angle) * (CFG.player.radius + 4);
    const spawnY = py + Math.sin(angle) * (CFG.player.radius + 4);

    const bullet = this.add.circle(spawnX, spawnY, CFG.bullet.radius, CFG.bullet.color);
    this.physics.add.existing(bullet);
    this.bullets.add(bullet);
    bullet.body.setCircle(CFG.bullet.radius);
    bullet.body.setOffset(-CFG.bullet.radius, -CFG.bullet.radius);
    bullet.body.setVelocity(
      Math.cos(angle) * CFG.bullet.speed,
      Math.sin(angle) * CFG.bullet.speed,
    );
    bullet.expiresAt = time + CFG.bullet.lifetimeMs;
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

    this.time.addEvent({
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

    this.nextWaveScheduled = true;
    this.time.delayedCall(CFG.waves.interWaveDelayMs, () => {
      this.nextWaveScheduled = false;
      this.startNextWave();
    });
  }

  onBulletHitEnemy(bullet, enemy) {
    bullet.destroy();
    enemy.destroy();

    this.comboMultiplier = Math.min(
      this.comboMultiplier + 1,
      CFG.combo.maxMultiplier,
    );
    this.lastKillAt = this.time.now;
    this.score += CFG.combo.scorePerKillBase * this.comboMultiplier;

    this.maybeStartNextWave();
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
      return;
    }

    enemy.destroy();
    this.stepDownBuff();
    this.player.hp -= CFG.enemy.contactDamage;
    this.comboMultiplier = 1;
    this.player.invulnerableUntil = this.time.now + CFG.player.hitFlashMs * 2;

    this.tweens.add({
      targets: this.player.sprite,
      alpha: 0.3,
      duration: CFG.player.hitFlashMs,
      yoyo: true,
      onComplete: () => this.player.sprite.setAlpha(1),
    });

    this.cameras.main.shake(120, 0.005);

    if (this.player.hp <= 0) {
      this.endGame();
    } else {
      this.maybeStartNextWave();
    }
  }

  endGame() {
    this.gameOver = true;
    this.physics.pause();
    if (this.bonusPickup) this.despawnBonus();
    if (this.shieldPickup) this.despawnShieldBonus();
    if (this.shieldActive) this.endShield();
    this.time.delayedCall(400, () => {
      this.scene.start('GameOverScene', { score: this.score, wave: this.wave });
    });
  }

  maybeDecayCombo(time) {
    if (
      this.comboMultiplier > 1 &&
      time - this.lastKillAt > CFG.combo.resetMs
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
      scale: { from: 1.4, to: 1 },
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
    this.player.barrel.setFillStyle(level.barrelColor);
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
    const ringRadius = CFG.player.radius + CFG.shieldBonus.ringRadiusPad;
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
    this.hudHp.setText(`HP: ${Math.max(0, this.player.hp)}`);
    this.hudScore.setText(`Score: ${this.score}`);
    this.hudWave.setText(`Wave: ${this.wave}`);
    this.hudCombo.setText(`Combo: x${this.comboMultiplier}`);

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
