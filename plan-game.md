# Arena Fight — Game Design & Implementation Plan (Phase 1)

> A top-down arena shooter for the browser, inspired by *Onslaught! Arena*.
> This document is the complete spec for the Phase 1 prototype.

---

## Table of contents

1. [Background](#1-background)
2. [Design philosophy & guiding principles](#2-design-philosophy--guiding-principles)
3. [Phase 1 feature scope (in / out)](#3-phase-1-feature-scope-in--out)
4. [Tech stack & rationale](#4-tech-stack--rationale)
5. [Architecture overview](#5-architecture-overview)
6. [Data & entity model](#6-data--entity-model)
7. [Subsystem design](#7-subsystem-design)
8. [Project layout & file-by-file plan](#8-project-layout--file-by-file-plan)
9. [Tunable constants (game feel)](#9-tunable-constants-game-feel)
10. [Implementation order & milestones](#10-implementation-order--milestones)
11. [Verification & acceptance criteria](#11-verification--acceptance-criteria)
12. [Future phases (roadmap)](#12-future-phases-roadmap)
13. [Risks & open questions](#13-risks--open-questions)

---

## 1. Background

### 1.1 What is *Onslaught! Arena*?

*Onslaught! Arena* is a fast-paced, retro top-down arcade shooter released in 2010 by Lost Decade Games. It's historically notable as one of the first commercial-quality games built entirely in HTML5/JavaScript — proving the browser was a viable game platform without Flash.

The core loop is timeless arcade design:

- **Single-screen arena**: no scrolling, no exploration. The entire battlefield is visible at all times.
- **Wave-based combat**: enemies spawn in escalating waves; clear them all to reach a boss.
- **Twin-stick-style controls**: WASD to move, mouse to aim and fire — 360° shooting.
- **Power-ups dropped by enemies**: temporary weapon swaps (spread, rapid-fire, AOE) keep combat varied.
- **Combo multiplier**: rapid kills without damage compound score; the game becomes a high-score chase.

### 1.2 What is "Arena Fight" (this project)?

**Arena Fight** is a browser game inspired by Onslaught! Arena. Long-term it should evolve toward the full Onslaught feature set (multiple enemy types, boss fights, power-ups, audio, pixel art) and optionally adopt modern roguelike ideas (XP gems, permanent-per-run upgrades, dash mechanics).

**This document covers Phase 1 only**: the minimum playable core loop. The point of Phase 1 is to validate the moment-to-moment feel — movement, aiming, shooting, dodging, dying — before investing in art, audio, or content variety. If the Phase 1 prototype isn't fun to play with squares chasing a circle, no amount of art will save it later.

### 1.3 What "done" means for Phase 1

A browser window opens, a blue circle moves with WASD, the mouse aims, left-click fires yellow dots, red squares chase the player and die when hit, waves escalate, the player can dash on Space, pause on Esc, dies after 3 hits, and sees a game-over screen with score and a restart prompt. That is the entirety of Phase 1.

---

## 2. Design philosophy & guiding principles

These are decisions that shape *how* we build, not *what* we build:

1. **Phase 1 is a feel prototype, not a product.** Primitive shapes. No audio. No art. No menus. We are buying information about whether the core loop is fun, with the cheapest possible build.
2. **Make every tunable knob easy to turn.** All numbers (speeds, HP, fire rate, wave sizes, colors) live in a single `config.js`. Playtesting will mean editing one file.
3. **No premature abstraction.** One enemy type means one `Enemy` class, not an `Enemy` base + `Swarmer` subclass. When we add a second type in Phase 2, *that's* when the abstraction earns its keep.
4. **No backwards-compatibility shims for code that doesn't exist yet.** We won't build a "weapon system" with one weapon, or a "scene manager" wrapping Phaser's scene manager.
5. **Trust the framework.** Phaser provides physics, input, scene management, groups, timers, tweens. Don't rebuild what's already there.
6. **Stable 60 FPS is a feature.** Top-down shooters live and die by responsiveness. We'll watch frame timing during testing and not let it slip below 60 FPS on a modest laptop.
7. **Greenfield, but disciplined.** The directory is empty. We get to set the shape of the project from scratch — keep it tight.

---

## 3. Phase 1 feature scope (in / out)

### ✅ In scope (Phase 1)

| Feature | Description |
|---|---|
| Player movement | WASD, with diagonal normalization (no √2 speed boost) |
| Aim & shoot | Mouse aim, left-click (hold = auto-fire) at fixed fire rate |
| Projectiles | Travel in a straight line, despawn off-screen or after lifetime |
| Swarmer enemy | One enemy type: moves directly toward player at constant speed |
| Wave system | N enemies per wave, count and speed escalate per wave |
| HP | Player starts with 3 HP; contact with enemy = 1 damage |
| Score | Points per kill, multiplied by current combo |
| Combo multiplier | Rises per kill, resets on damage or after timeout |
| HUD | Text-based HP / Score / Wave / Combo display, top of screen |
| Dash | Spacebar = short burst + brief invulnerability, cooldown-gated |
| Pause | Esc or P toggles pause overlay |
| Game over | When HP reaches 0 → game-over scene with final score + restart |
| Restart | R key (or click) from game-over returns to a fresh GameScene |

### ❌ Out of scope (deferred)

- Boss fights
- Multiple enemy types (ranged attackers, tanks)
- Power-ups / weapon variety / weapon switching
- Audio (SFX + music)
- Pixel art / sprite assets / animations
- Roguelike upgrades / XP gems / permanent perks
- Environmental hazards
- Persistence (high-score storage / leaderboards)
- Responsive canvas / mobile or touch controls
- TypeScript migration
- Menu / settings screen
- Multiplayer

These are not "nice-to-haves we'll get to if we have time" — they are explicitly **not** Phase 1. Adding any of them now extends the time to validate the feel, which is the only thing Phase 1 exists to do.

---

## 4. Tech stack & rationale

| Layer | Choice | Why |
|---|---|---|
| Game framework | **Phaser 3** (latest stable) | Mature 2D framework with built-in physics, input, scenes, groups, tweens, timers. Solves every problem Phase 1 has without us writing engine code. |
| Build tool | **Vite** | Instant dev server with HMR, native ES modules, zero config for our needs. |
| Language | **JavaScript** (ESM) | Phase 1 is small enough that TypeScript's overhead (config, types, build complexity) doesn't pay back yet. We can migrate in a later phase. |
| Physics | **Phaser Arcade Physics** | Built into Phaser. Velocity-based, AABB collisions, overlap callbacks. Perfect for top-down shooters. We do **not** need Matter.js for Phase 1. |
| Graphics | **Phaser `Graphics` / shape game objects** | Primitive circles/rectangles drawn at runtime. Zero asset pipeline. |
| Package manager | **npm** | Comes with Node. No reason to introduce yarn/pnpm. |

### 4.1 Why Phaser over alternatives

- **vs. raw HTML5 Canvas**: we'd be writing our own game loop, input handling, scene transitions, collision detection. That's the engine-building tax — fun, but not the point of Phase 1.
- **vs. PixiJS**: Pixi is a renderer, not a game framework. We'd still need to bolt on physics and input.
- **vs. Godot / Unity**: those export to HTML5 but produce large bundles and don't feel native to the browser. The user explicitly wanted an HTML game.

### 4.2 Why Vite

- Native ESM imports (`import Phaser from 'phaser'`) work out of the box.
- HMR means tweaking `config.js` values doesn't require a full page reload — fast playtesting iteration.
- `npm run build` produces a static `dist/` we can deploy anywhere (GitHub Pages, Netlify, etc.) in later phases.

---

## 5. Architecture overview

### 5.1 High-level shape

```
                ┌─────────────────────────────────────────┐
                │            Phaser.Game (main.js)         │
                │   width 800, height 600, arcade physics │
                └────────────────┬────────────────────────┘
                                 │
                  ┌──────────────┴──────────────┐
                  │                             │
            ┌─────▼─────┐                ┌──────▼────────┐
            │ GameScene │ ──(on death)─▶ │ GameOverScene │
            └─────┬─────┘  ◀(on R key)── └───────────────┘
                  │
   ┌──────────────┼──────────────┬──────────────┬──────────────┐
   │              │              │              │              │
┌──▼───┐    ┌─────▼────┐   ┌─────▼─────┐  ┌────▼────┐    ┌────▼────┐
│Player│    │Enemies   │   │Bullets    │  │  Wave   │    │ Combo   │
│      │    │(Group)   │   │(Group)    │  │ Manager │    │ Tracker │
└──────┘    └──────────┘   └───────────┘  └─────────┘    └─────────┘
```

Phaser's `Scene` is the unit of game state. Phase 1 has two scenes: `GameScene` (gameplay) and `GameOverScene` (results + restart). All gameplay objects, groups, and per-tick logic live inside `GameScene`.

### 5.2 Game loop (per frame, driven by Phaser)

Each frame at ~60 FPS, Phaser does the following automatically:

1. **Input poll** → keyboard state and pointer position are updated.
2. **Physics step** → Arcade Physics advances velocities, resolves world-bound collisions.
3. **`scene.update(time, delta)`** is called → our per-frame logic runs (see §7.1).
4. **Overlap/collision callbacks fire** → bullet-hits-enemy, player-hits-enemy.
5. **Render** → Phaser draws all game objects to the canvas.

We never call `requestAnimationFrame` ourselves; Phaser owns the loop.

### 5.3 Scene lifecycle (Phaser convention)

Each scene has three hooks we'll use:

- **`preload()`** — load assets. Phase 1 has no assets, so this is empty (or omitted).
- **`create()`** — one-time setup: create entities, groups, input handlers, HUD, start wave 1.
- **`update(time, delta)`** — per-frame logic: read input, move player, enemy AI, fire timing, combo decay.

### 5.4 Data flow per frame (GameScene)

```
keyboard/mouse input
        │
        ▼
   update() reads input
        │
        ├─▶ set player.body.velocity (movement)
        ├─▶ if pointerdown && fireReady: spawn bullet with velocity toward pointer
        ├─▶ if Space pressed && dashReady: trigger dash (override velocity, set i-frames)
        ├─▶ for each enemy: set velocity toward player position
        ├─▶ tick combo timer (decay if no kill in window)
        └─▶ refresh HUD text
                │
                ▼
        Phaser physics step
                │
                ├─▶ overlap(bullets, enemies) → onBulletHitEnemy()
                │       └─▶ destroy both; score += base * combo; combo++; lastKillAt = now
                │
                └─▶ overlap(player, enemies) → onPlayerHitEnemy()
                        └─▶ if not invulnerable: hp--; combo = 1; destroy enemy
                        └─▶ if hp <= 0: scene.start('GameOverScene', {score, wave})
                │
                ▼
              render
```

---

## 6. Data & entity model

### 6.1 Player

Single object on the scene. Properties live as fields on a custom object (or directly on a Phaser game object's `data`):

| Field | Type | Purpose |
|---|---|---|
| `sprite` | Phaser `Arc` (circle) with Arcade body | The visible/colliding player |
| `hp` | number | Hit points (starts at 3) |
| `nextFireAt` | number (ms) | Timestamp when next shot is allowed |
| `dashEndsAt` | number (ms) | When current dash ends (0 if not dashing) |
| `dashReadyAt` | number (ms) | When next dash is allowed |
| `invulnerableUntil` | number (ms) | I-frame end timestamp |

### 6.2 Enemy (swarmer)

Member of a Phaser physics `Group`. One enemy per `Arc` game object:

| Field | Type | Purpose |
|---|---|---|
| `sprite` | Phaser `Arc` with Arcade body | Visible/colliding enemy |
| `hp` | number | Currently always 1 (one-shot kills) |
| `speed` | number | Set at spawn from current wave's enemy speed |

Per-frame AI: velocity vector points from enemy → player, normalized, scaled by `speed`. That's the entire AI.

### 6.3 Bullet

Member of a Phaser physics `Group`. Created on fire, destroyed on hit / off-screen / after `lifetimeMs`:

| Field | Type | Purpose |
|---|---|---|
| `sprite` | Phaser `Arc` with Arcade body | Visible/colliding bullet |
| `expiresAt` | number (ms) | When to despawn even if still on screen |

### 6.4 Scene-level state (held on `GameScene`)

| Field | Purpose |
|---|---|
| `score` | Running score for this run |
| `wave` | Current wave number (starts at 1) |
| `comboMultiplier` | 1..maxMultiplier |
| `lastKillAt` | ms timestamp of most recent kill (drives combo decay) |
| `enemySpeedThisWave` | Current wave's swarmer speed (escalates per wave) |
| `pendingSpawns` | Count of enemies still queued to spawn this wave |
| `paused` | Boolean (Phaser also tracks this on the scene) |

---

## 7. Subsystem design

### 7.1 Input & movement

- Use `this.input.keyboard.addKeys('W,A,S,D,SPACE,ESC,P')` plus arrow keys via cursors.
- In `update()`:
  ```
  vx = (D.isDown - A.isDown)   // -1, 0, or +1
  vy = (S.isDown - W.isDown)
  if (vx !== 0 && vy !== 0): normalize so |v| = 1   // no diagonal speed bonus
  player.body.velocity = (vx, vy) * CFG.player.speed
  ```
- If dashing, override the above with the dash velocity until `dashEndsAt`.

### 7.2 Aiming & firing

- Aim angle = `Math.atan2(pointer.y - player.y, pointer.x - player.x)`.
- Optional: rotate the player visual to face the pointer (makes shape-based feel directional).
- Fire trigger:
  - Use `this.input.activePointer.isDown` for hold-to-fire.
  - Gate by `time >= nextFireAt`. On fire, set `nextFireAt = time + CFG.player.fireRateMs`.
- Spawn bullet:
  - At player position; velocity = `(cos(angle), sin(angle)) * CFG.bullet.speed`.
  - `expiresAt = time + CFG.bullet.lifetimeMs`.

### 7.3 Enemy AI (swarmer)

- On spawn: pick a random side (top/bottom/left/right), random position along that side, just outside the world bounds. Add to `enemies` group.
- In `update`, for each active enemy: set velocity vector = `(player.x - enemy.x, player.y - enemy.y)` normalized, scaled by `enemy.speed`.
- That's it. No state machine, no flocking, no avoidance. Phase 1.

### 7.4 Wave manager

- `startWave(n)` is called when wave 0 begins and after `interWaveDelayMs` following the previous wave clear.
- Wave size: `count = CFG.waves.baseCount + CFG.waves.growthPerWave * (n - 1)`.
- Wave speed: `enemySpeedThisWave = CFG.enemy.speed + CFG.waves.enemySpeedGrowth * (n - 1)`.
- Use `this.time.addEvent({ delay, repeat: count - 1, callback: spawnEnemy })`.
- Track `pendingSpawns` (decrement in `spawnEnemy`). When `pendingSpawns === 0` **and** `enemies.countActive() === 0`, schedule `startWave(n + 1)` after `interWaveDelayMs`.

### 7.5 Combo tracker

- On kill: `comboMultiplier = min(comboMultiplier + 1, CFG.combo.maxMultiplier); lastKillAt = now; score += CFG.combo.scorePerKillBase * comboMultiplier`.
- On player damage: `comboMultiplier = 1`.
- In `update`: if `now - lastKillAt > CFG.combo.resetMs && comboMultiplier > 1`: `comboMultiplier = 1`. (Phase 1 keeps it simple: hard reset, not gradual decay.)

### 7.6 Dash & i-frames

- On Space (with `JustDown` check to avoid auto-repeat): if `now >= dashReadyAt`:
  - Compute dash direction from current movement input (fallback: aim direction if standing still).
  - `dashEndsAt = now + CFG.player.dashDurationMs`
  - `invulnerableUntil = dashEndsAt`
  - `dashReadyAt = now + CFG.player.dashCooldownMs`
- In `update`: while `now < dashEndsAt`, override player velocity with `dashDir * CFG.player.dashSpeed`.
- Player-vs-enemy overlap handler: ignore damage if `now < invulnerableUntil`.
- Visual feedback: tween player alpha to 0.5 during dash; back to 1 after (Phase 1 polish, cheap).

### 7.7 Pause

- On Esc or P pressed (use `Phaser.Input.Keyboard.JustDown`):
  - If not paused: show "PAUSED — press P to resume" text; call `this.scene.pause()`.
  - If paused: hide text; call `this.scene.resume()`.
- Since the paused scene doesn't run `update`, we need to handle the resume keypress via a separate one-shot listener or by always listening at the input level.
- Simpler approach: use `this.physics.pause()` / `this.physics.resume()` and skip `update` logic via a `this.paused` flag. (Cleaner because input still flows.)

### 7.8 Collision handlers

Set up in `create()`:

```
this.physics.add.overlap(bullets, enemies, this.onBulletHitEnemy, null, this);
this.physics.add.overlap(player.sprite, enemies, this.onPlayerHitEnemy, null, this);
```

- `onBulletHitEnemy(bullet, enemy)`: destroy bullet; destroy enemy; combo++; score += base * combo; lastKillAt = now.
- `onPlayerHitEnemy(playerSprite, enemy)`: if `now < invulnerableUntil` return; hp--; combo = 1; destroy enemy; brief tint flash (red tween for 200ms); if hp <= 0: `this.scene.start('GameOverScene', { score, wave })`.

### 7.9 HUD

- Four `this.add.text(...)` objects placed top-left / top-right.
- Updated each frame in `update()` (cheap, just string assignment).
- Layout (pixel positions):
  - `HP: 3`  at (10, 10)
  - `Score: 0`  at (10, 30)
  - `Wave: 1`  at (790, 10) right-aligned
  - `Combo: x1`  at (790, 30) right-aligned

### 7.10 GameOverScene

- Receives `{ score, wave }` via `init(data)`.
- Renders three lines centered:
  - "GAME OVER"
  - `Wave reached: N    Score: X`
  - "Press R to restart"
- Listens for `R` key (`Phaser.Input.Keyboard.JustDown`): `this.scene.start('GameScene')`.

---

## 8. Project layout & file-by-file plan

```
arena-fight/
├── package.json
├── vite.config.js
├── index.html
├── README.md
├── .gitignore
└── src/
    ├── main.js
    ├── config.js
    └── scenes/
        ├── GameScene.js
        └── GameOverScene.js
```

### 8.1 `package.json`

- `type: "module"`
- `scripts`: `dev` → `vite`, `build` → `vite build`, `preview` → `vite preview`
- `dependencies`: `phaser`
- `devDependencies`: `vite`

### 8.2 `vite.config.js`

Minimal — defaults are fine. Optionally set `server: { port: 5173, open: true }`.

### 8.3 `index.html`

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Arena Fight</title>
    <style>
      body { margin: 0; background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; }
      #game { box-shadow: 0 0 20px rgba(255,255,255,0.1); }
    </style>
  </head>
  <body>
    <div id="game"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

### 8.4 `src/main.js`

- Import Phaser and both scenes.
- Build `Phaser.Game` config:
  - `type: Phaser.AUTO`
  - `width: 800, height: 600`
  - `parent: 'game'`
  - `backgroundColor: '#1a1a1a'`
  - `physics: { default: 'arcade', arcade: { debug: false } }`
  - `scene: [GameScene, GameOverScene]`
- `new Phaser.Game(config);`

### 8.5 `src/config.js`

The single tuning surface for the whole game. Exports one object `CFG`. See §9 for default values.

### 8.6 `src/scenes/GameScene.js`

Single class extending `Phaser.Scene`. Sections within the file:

1. `constructor()` — `super('GameScene')`
2. `create()` — wire everything (entities, groups, input, colliders, HUD, start wave 1)
3. `update(time, delta)` — per-frame: movement, fire, dash, enemy AI, combo decay, HUD refresh
4. **Helpers** (methods on the class):
   - `spawnPlayer()`
   - `fireBullet(time)`
   - `spawnEnemy()`
   - `startWave(n)`
   - `onBulletHitEnemy(bullet, enemy)`
   - `onPlayerHitEnemy(playerSprite, enemy)`
   - `tryDash(time)`
   - `togglePause()`
   - `updateHUD()`

Expected size: ~250–350 lines.

### 8.7 `src/scenes/GameOverScene.js`

Single class extending `Phaser.Scene`:

1. `constructor()` — `super('GameOverScene')`
2. `init(data)` — store `data.score` and `data.wave`
3. `create()` — render text; bind R key
4. `update()` — check for R key; on press, `this.scene.start('GameScene')`

Expected size: ~40 lines.

### 8.8 `README.md`

Three sections:
- **What**: one paragraph.
- **Run**: `npm install && npm run dev`, then open the printed URL.
- **Controls**: WASD move, mouse aim, click fire, Space dash, P/Esc pause, R restart on game over.

### 8.9 `.gitignore`

`node_modules/`, `dist/`, `.DS_Store`.

---

## 9. Tunable constants (game feel)

All in `src/config.js`. These are *starting* values; tuning will happen via playtesting.

```js
export const CFG = {
  player: {
    speed: 220,            // px/s
    hp: 3,
    radius: 14,            // px
    color: 0x4fc3f7,       // light blue
    fireRateMs: 180,       // ~5.5 shots/sec
    dashSpeed: 600,        // px/s during dash
    dashDurationMs: 150,
    dashCooldownMs: 800,
    hitFlashMs: 200,       // red tint duration on damage
  },
  bullet: {
    speed: 520,
    radius: 4,
    color: 0xffeb3b,       // yellow
    lifetimeMs: 1200,
  },
  enemy: {
    speed: 90,             // px/s base
    hp: 1,
    radius: 12,
    color: 0xe53935,       // red
    contactDamage: 1,
  },
  waves: {
    baseCount: 5,                  // wave 1 has 5 enemies
    growthPerWave: 3,              // each wave adds 3 more
    spawnIntervalMs: 600,          // delay between spawns in a wave
    interWaveDelayMs: 1500,        // gap between waves
    enemySpeedGrowth: 6,           // px/s added to enemy speed per wave
  },
  combo: {
    resetMs: 2500,                 // no kill for this long → combo resets
    maxMultiplier: 8,
    scorePerKillBase: 100,         // final score = base * current multiplier
  },
  arena: {
    width: 800,
    height: 600,
  },
};
```

---

## 10. Implementation order & milestones

I'll build in slices that each end with a runnable game — useful for early sanity checks.

**M1 — Boot to black screen**
- `package.json`, `vite.config.js`, `index.html`, `src/main.js` (empty scenes registered).
- `npm run dev` opens a dark grey 800×600 canvas. Nothing else.

**M2 — Player exists and moves**
- `GameScene.create()` spawns a blue circle in the center.
- WASD movement (with diagonal normalization).
- Player can't leave the arena (world bounds).

**M3 — Aim & shoot**
- Player rotates toward the mouse pointer.
- Left-click (hold) fires yellow circles toward the pointer at fixed rate.
- Bullets despawn off-screen / after lifetime.

**M4 — Enemies & basic combat**
- Single spawn (no waves yet) of red swarmers from a random edge.
- Swarmers chase the player.
- Bullets destroy enemies on contact (overlap).
- Player-enemy contact reduces HP. At 0 HP → GameOverScene (placeholder).

**M5 — Waves**
- WaveManager kicks in: wave 1 spawns N enemies, wait until all dead, escalate, repeat.
- HUD shows current wave.

**M6 — Score, combo, HUD polish**
- Score increments per kill, multiplied by combo.
- Combo rises per kill, resets on damage or after timeout.
- HUD shows HP, Score, Wave, Combo.

**M7 — Dash + i-frames + pause**
- Spacebar dash with cooldown and brief invulnerability.
- Esc/P pause overlay.

**M8 — GameOverScene + restart**
- Game-over scene with final score and wave.
- R restarts.

**M9 — Tuning pass**
- Playtest. Adjust numbers in `config.js`. Goal: 60-FPS stable, "feels good" to play for at least 3-5 minutes per run.

Each milestone is a green checkpoint. If a milestone breaks, fix before moving on.

---

## 11. Verification & acceptance criteria

After implementation, confirm Phase 1 is done by running this checklist end-to-end.

### 11.1 Setup verification

```bash
cd /home/shahar/repos/arena-fight
npm install        # installs phaser + vite
npm run dev        # starts dev server, prints URL like http://localhost:5173/
```

Browser opens to URL → 800×600 dark canvas appears with no console errors.

### 11.2 Golden-path manual test

1. **Spawn**: blue circle in center; HUD shows `HP: 3   Score: 0   Wave: 1   Combo: x1`.
2. **Movement**: WASD moves player smoothly. Diagonals feel the same speed as cardinals.
3. **Boundary**: player cannot leave the visible arena.
4. **Aim**: moving the mouse rotates the player to face the cursor.
5. **Fire**: holding left-click streams yellow circles toward the cursor at roughly 5/sec.
6. **Enemies appear**: within ~1 second, red circles spawn from edges and walk toward player.
7. **Kills**: bullet contact destroys enemies; score increases; combo multiplier climbs (x2, x3, …).
8. **Damage**: walking into an enemy reduces HP by 1, resets combo to x1, destroys that enemy.
9. **Wave clear**: when all enemies are dead, after ~1.5s, wave counter increments and a larger / faster batch spawns.
10. **Dash**: Space triggers a dash (visible: player briefly translucent and moves fast); dashing through an enemy doesn't take damage; dash is gated by ~0.8s cooldown.
11. **Pause**: P or Esc pauses (enemies and bullets freeze, "PAUSED" overlay appears); pressing again resumes.
12. **Death**: when HP hits 0, scene transitions to "GAME OVER" with final score, wave reached, "Press R to restart".
13. **Restart**: R returns to a fresh GameScene with HP 3, Score 0, Wave 1.

### 11.3 Non-functional checks

- DevTools Performance tab: stable 60 FPS during a wave with 15+ enemies and bullets on screen.
- No errors or warnings in the browser console during a full run.
- `npm run build` succeeds and produces a `dist/` folder that runs via `npm run preview`.

If all 13 manual steps pass and the non-functional checks hold, Phase 1 is **complete** and we can begin scoping Phase 2.

---

## 12. Future phases (roadmap)

Not part of this plan to implement, but worth sketching so Phase 1 decisions don't paint us into a corner.

- **Phase 2 — Combat variety**
  - 2 more enemy types: **Ranged** (keeps distance, fires projectiles) and **Tank** (slow, high HP, blocks shots).
  - Refactor `Enemy` into a base class with subclasses (this is when the abstraction pays off).
- **Phase 3 — Power-ups**
  - Defeated enemies have a chance to drop a temporary weapon: Spread Shot, Rapid Fire, Bomb.
  - 10-second duration; visual icon on HUD shows remaining time.
- **Phase 4 — Boss**
  - Wave 5 (or every Nth wave) ends in a boss fight: large enemy with HP bar and multi-phase attack patterns.
- **Phase 5 — Audio**
  - SFX for shoot, hit, enemy death, dash, player damage, wave clear, game over.
  - Looping chiptune background music.
  - Tools: bfxr / ChipTone for SFX; CC0 chiptune track for music.
- **Phase 6 — Pixel art**
  - Replace primitive shapes with 16×16 / 32×32 pixel-art sprites.
  - Asset pipeline: Aseprite source files; PNG exports under `src/assets/`.
- **Phase 7 — Roguelike layer**
  - XP gems drop from enemies; on level-up, choose 1 of 3 randomly-rolled perks (e.g., +10% speed, bouncing projectiles, faster fire).
  - Persistent meta-progression: unlock new perks across runs.
- **Phase 8 — Polish & ship**
  - Title screen, settings (volume, key remap), high-score persistence via `localStorage`.
  - Deploy to GitHub Pages / Netlify.

---

## 13. Risks & open questions

### Risks

- **Game feel might be off with the default numbers.** Mitigation: every tunable lives in `config.js`; expect a tuning pass at M9.
- **Phaser learning curve.** Mitigation: Phase 1 uses only well-documented basics (Arc shapes, Arcade Physics overlap, scene transitions). Phaser docs at `https://photonstorm.github.io/phaser3-docs/` are good.
- **Performance degradation with many enemies.** At wave 10 we could see 30+ enemies and 50+ bullets. Mitigation: Arcade Physics is fast; if needed we can pool bullets/enemies (Phaser groups support pooling natively).
- **Diagonal movement bug** (faster on diagonals): easy to forget normalization. Covered explicitly in §7.1.
- **Dash direction ambiguity** (what if the player isn't moving when they hit Space?): handled in §7.6 — fallback to aim direction.

### Open questions (deferred to playtesting)

- Is 3 HP the right starting amount, or should it be 5?
- Should waves give a brief pause for the player to breathe, or chain seamlessly?
- Should the combo multiplier cap at 8 (current default) or higher?
- Should dashing through an enemy *damage* the enemy (a la *Hades*) or just pass through?

These don't block implementation — answer them when the prototype is in hand.

---

*End of Phase 1 plan.*
