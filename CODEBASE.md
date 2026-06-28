# Arena Fight — Codebase Overview & Implementation State

> Self-contained context dump for the Arena Fight browser game. Load this into any LLM and it should have enough to continue development without reading source files.
>
> Companion docs in the repo: `plan-game.md` (original Phase 1 design plan), `plan-store.md` (store/meta-progression plan), `README.md` (player-facing summary). This document supersedes both — it describes what is actually implemented today.

---

## Current update note — 2026-06-20

Recent implementation has moved beyond the original Phase 1 notes below:

- The game now boots through `IntroScene`, using `public/assets/intro/intro.png`, then transitions to `MainMenuScene`.
- `MainMenuScene` is the only menu flow and also renders game-over details after death. **Boss checkpoints:** when `Save.getCheckpointWave() > 0` it shows **CONTINUE** (resume at `checkpointWave + 1`) and **NEW GAME** (fresh wave-1 run, keeps the checkpoint) instead of a single START/RETRY; the death screen surfaces "You'll continue from Wave N". The start wave is threaded to `GameScene` via `scene.start('GameScene', { startWave })` and through `LoadoutScene`'s START (`GameScene.create` reads `data.startWave`, defaulting to 1).
- Music is loaded from `public/assets/music/retro_game_music.mp3` (normal soundtrack) and `public/assets/music/boss_battle_music.mp3` (boss soundtrack) through `src/audio.js`.
- Boss waves swap to the intense boss track: `GameScene.startBossWave()` calls `enterBossMusic(scene)` (cross-fades the normal track out, the boss track in) and every boss-end path resolves back via `exitBossMusic(scene)` — `teardownBossState()` (boss death + the `jumpToWave` cheat), `endGame()` (player death mid-boss), and the scene `SHUTDOWN` handler. The music manager (registry singleton in `src/audio.js`) tracks a `bossMode` flag so `syncMusic`/the music toggle keep the correct track audible and obey `musicEnabled`/`musicVolume`; only one track plays at a time. The Suno generation prompt for the boss track is in `plan_docs/ui_ux_top20_prompts/ui_ux_task16.md`.
- Boss waves also swap the arena field to a hostile **"hell arena"** background in lockstep with the boss music. `startBossWave()` calls `enterBossBackground()` (cross-fades a `hell-arena.png` overlay in over the player's selected background across `CFG.boss.transitionMs`) and every boss-end path calls `exitBossBackground()` next to `exitBossMusic` — `teardownBossState()`, `endGame()`, and the `SHUTDOWN` handler (immediate, no fade). A `this.bossBackgroundActive` flag mirrors the music `bossMode`; `handleResize()` cover-fits whichever backgrounds are live. The hell background is the `BOSS_BACKGROUND` export in `src/backgrounds.js` (kept out of the Settings picker), loaded in `GameScene.preload()`. While the flag is set, standard player bullets use `CFG.bullet.bossColor` (light) instead of `CFG.bullet.color` so fire stays readable over the dark floor; AoE/boomerang bullets keep their own colour. The generation prompt is in `plan_docs/boss-retro-art-prompts.md`.
- Sound effects are loaded from `public/assets/sounds/*.wav` through `src/audio.js` (the `SFX` map) and played via `playSfx(scene, id)`. Gameplay cues (enemy hit/death, boss hit/spawn/phase/defeat, player hit, shield block, dash ready, combo up/break, big coin, mod grant, shield pickup, wave start/clear, game start) fire from `GameScene`; UI cues (`uiMove`/`uiConfirm`/`uiCancel`, `purchase`/`purchaseFail`) fire from the menu, store, loadout, settings, and monsters scenes (each calls `preloadSfx` in `preload`). Generation prompts and target durations are in `plan_docs/sound-effects-prompts.md`.
- Music settings persist in `Save.settings` as `musicEnabled` and `musicVolume`.
- Sound-effect settings persist in `Save.settings` as `sfxEnabled` and `sfxVolume`.
- `SettingsScene` controls arena background, music on/off and volume, sound-effect on/off and volume, the touch-controls mode (Auto / On / Off), and the fullscreen toggle (On / Off).
- Touch/mobile mode persists in `Save.settings` as `touchControls` (`'auto' | 'on' | 'off'`); resolved at boot by `src/input/touchMode.js`.
- Achievements are tiered (`src/achievements.js`): tiered entries declare ascending `tiers` targets + a `progress(ctx)` evaluator (one unlockable id per tier, `<id>-N`), boolean entries declare `check(ctx)` + `points`. Tier metals carry points (Bronze 10 / Silver 25 / Gold 50 / Diamond 100). `evaluateAchievements(ctx, unlockedIds)` returns newly-passing ids; helpers `tierProgress`, `unlockedPoints`, `bestUnlock`, `playerLevel` drive the UI. `AchievementsScene` (reached via the menu **ACHIEVEMENTS** button / `A`) is a category-tabbed grid of badge tiles — full colour when unlocked, grey-tinted while locked — with a tap-to-open detail popup showing a `current/target` progress bar. Badges are PNGs at `public/assets/achievements/<tierId>.png`; `sceneUtils.addBadge`/`applyBadgeState` render them (with a drawn-medallion fallback when a PNG is missing). `MainMenuScene` adds a "Best" showcase (Best Wave / Best Score / Bosses Defeated, rarest badge, achievement level/points) and a grey→colour badge reveal for new unlocks at game over. `Save.achievements` is still an array of ids; the `v3 → v4` migration (`CURRENT_VERSION = 5`) remaps the old flat ids to tiers (recomputed from lifetime stats). `CFG.achievements.pointsPerLevel` tunes the points→level curve.
- Static generated assets live under `public/assets/...`; Phaser code resolves them through `src/assetPath.js` so builds work at `/arena-fight/` on GitHub Pages. Windows `*:Zone.Identifier` sidecars are ignored.
- The wave-10 Warden and wave-20 Juggernaut each have complete 21-frame 256×256 sprite sets, the wave-30 Hexweaver and wave-40 Bombardier each have 23 frames, the wave-50 Phantom, wave-60 Overlord, wave-70 Tempest, and wave-80 Colossus each have 25 frames, and the wave-90 Voidcaller has 27 frames under `public/assets/enemies/boss/`; `BOSS_SPRITES` registers their directional idle, movement, power, enrage, and death frames.
- `src/viewport.js` owns the responsive scale strategy. **Desktop windowed** stays `Scale.NONE` 800×600 (unchanged); **desktop fullscreen** switches to `Scale.FIT` (4:3 scaled up, centered) and back to 800×600 on exit; **mobile/touch** uses `Scale.FIT` with a fixed logical height (600) and a width set to `round(600 × innerW/innerH)` (clamped 600–1400) so the canvas fills the device with no letterbox bars — the arena simply gets wider. On mobile, window resize/rotate recomputes that width via `game.scale.setGameSize(w, 600)`, which emits Phaser's `RESIZE` event. `GameScene` reflows live on resize (`handleResize` updates `this.arenaW/arenaH`, world bounds, background fit, HUD via `layoutHud()`, and touch-control anchors) with **no scene restart**; menu scenes rebuild via restart-on-resize. Fullscreen defaults off (`Save.settings.fullscreen`) on both desktop and touch; it is opt-in via `F` or the Settings row, and auto-enters on the first Intro tap only when the preference is on. Shared cover-fit background helper: `src/scenes/sceneUtils.js` → `coverBackground(scene, key, existing?)`.
- **Touch has no keyboard**, so `src/scenes/sceneUtils.js` also exposes `isTouchMode()` and `addTouchButton(scene, {...})` (a screen-anchored, high-depth tappable button). When touch is active each scene adds on-screen equivalents for its keyboard actions: `GameScene` a top-left **MENU** button (opens the pause menu, whose Resume/Restart/Settings/Quit buttons are all tappable); `StoreScene` makes the tab labels and each list row directly tappable (click a row to select + buy, with a touch-only BUY/CANCEL confirm dialog) plus a BACK button; `LoadoutScene` makes each slot tappable to select with inline ◀/▶ arrows to cycle its choice, plus BACK and START buttons; `MonstersScene`/`SettingsScene` a BACK button. `TouchControls.handleDown` ignores pointers over depth ≥ 1500 UI buttons so taps don't also drive the movement stick.

---

## Table of contents

1. [What this is](#1-what-this-is)
2. [Tech stack & dependencies](#2-tech-stack--dependencies)
3. [How to run](#3-how-to-run)
4. [File layout](#4-file-layout)
5. [Architecture](#5-architecture)
6. [Game subsystem reference](#6-game-subsystem-reference)
7. [Catalog: weapons & mods](#7-catalog-weapons--mods)
8. [Config reference (CFG)](#8-config-reference-cfg)
9. [Save schema](#9-save-schema)
10. [Scene transitions](#10-scene-transitions)
11. [Known issues / Phase 1 caveats](#11-known-issues--phase-1-caveats)
12. [How to extend](#12-how-to-extend)
13. [Glossary](#13-glossary)

---

## 1. What this is

**Arena Fight** is a top-down, single-screen, browser-based arena shooter inspired by *Onslaught! Arena* (Lost Decade Games, 2010). Built with Phaser 3 and Vite. Primitive shapes only (no sprite assets). Designed to be tuned via a single `config.js` file.

**Genre & loop:**

- WASD movement, mouse aim, hold-click to fire.
- Survive escalating waves of enemies on a fixed 800×600 arena.
- Build combo multiplier by chaining kills without taking damage.
- Pick up power-up bonuses mid-wave (tiered fire-rate upgrade + shield).
- Die → see results → spend earned coins in the store on weapons / mods → equip a loadout → start a new run.
- Roguelite meta-progression: coins, owned items, and loadout persist in `localStorage`.

**Current state:** A complete Phase 1 prototype + the full meta-progression store layer. No audio. No sprites. No menu screen — game starts straight into the first run.

---

## 2. Tech stack & dependencies

| Layer | Choice | Version |
|---|---|---|
| Game framework | Phaser | `^3.80.1` (resolved: 3.90.0) |
| Build tool / dev server | Vite | `^5.4.0` |
| Language | JavaScript ESM | — |
| Physics | Phaser Arcade Physics (built-in) | — |
| Renderer | Phaser AUTO (WebGL preferred, Canvas fallback) | — |
| Persistence | `localStorage` | — |
| Package manager | npm | — |

`package.json` scripts: `dev`, `build`, `preview` (all standard Vite).

No TypeScript. No test framework. No linter configured. GitHub Actions deploys the static Vite build to GitHub Pages on pushes to `main`.

---

## 3. How to run

```bash
npm install
npm run dev      # http://localhost:5173/  (also bound to 0.0.0.0)
npm run build    # produces ./dist
npm run preview  # serves built ./dist
npm run test:run # Vitest unit suite with coverage
npm run test:e2e # Playwright end-to-end suite (builds + previews, drives Chromium)
```

**End-to-end tests** live in `e2e/` (Playwright) and exercise the real built game:
smoke/boot, scene navigation, gameplay (enemies spawn + score climbs), and save
persistence across reloads. They drive the game through a read-only test hook,
`window.__arena` (`src/testHooks.js`), which is installed **only** when the page is
opened with `?e2e=1` and exposes `activeSceneKeys`, live `state`, and the `save`
snapshot. The hook is inert and absent for real players. The suite runs daily via
`.github/workflows/e2e-daily.yml` (06:00 UTC cron) and opens/updates a GitHub issue
on failure. Note: the Intro screen is left by **clicking the canvas** (its
`pointerdown` handler) once `IntroScene` is active — Playwright key events only reach
Phaser after the canvas has been focused by that first click.

**Controls** (also documented in `README.md`):

| Action | Key |
|---|---|
| Move | `W` `A` `S` `D` (or arrow keys) |
| Aim | Mouse |
| Fire (hold) | Left mouse button |
| Dash | `Space` (brief invulnerability, cooldown-gated) |
| Fullscreen | `F` |
| Pause / Resume | `P` or `Esc` |
| Restart (Game Over) | `R` |
| Open Store (Game Over) | `S` |
| Open Loadout (Game Over) | `L` |

On touch devices (phones/tablets) the game auto-switches to on-screen **twin-stick**
controls: left stick moves, right stick aims and auto-fires, plus dash, pause, and
weapon-switch buttons. The game is landscape-only there — a "rotate your device"
overlay shows and the game loop sleeps while held in portrait. Desktop/web is
unchanged. Touch mode is auto-detected (`pointer: coarse`) and overridable in
`SettingsScene` (Auto / On / Off, persisted as `Save.settings.touchControls`).
See `src/input/touchMode.js`, `src/input/touchControls.js`, and
`src/input/orientationLock.js`.

---

## 4. File layout

```
arena-fight/
├── package.json              # phaser + vite, type:module
├── vite.config.js            # dev port 5173; production base /arena-fight/
├── .github/workflows/
│   ├── deploy.yml            # builds dist and deploys to GitHub Pages
│   ├── pr-build.yml          # PR lint/build/unit-test gate
│   └── e2e-daily.yml         # daily Playwright E2E cron (06:00 UTC) + failure issue
├── e2e/                      # Playwright end-to-end specs + shared fixtures
├── playwright.config.js      # E2E config: builds+previews, baseURL /arena-fight/
├── index.html                # mounts #game div, loads /src/main.js
├── README.md                 # short player-facing readme
├── plan-game.md              # Phase 1 design (predates implementation)
├── plan-store.md             # store/meta plan (predates implementation)
├── CODEBASE.md               # this document
├── .gitignore                # ignores node_modules, dist, .claude state, etc.
├── .claude/
│   └── skills/
│       └── update-readme/
│           └── SKILL.md      # project-level skill: keep README in sync with code
└── src/
    ├── main.js               # Phaser.Game config; registers all scenes
    ├── assetPath.js          # prefixes public asset paths with Vite's base URL
    ├── config.js             # All tunable constants (CFG)
    ├── save.js               # localStorage wrapper, defaults, persistence API
    ├── catalog.js            # Weapons + mods, prices, apply functions
    ├── skins.js              # Character skins catalog (cosmetic body swaps)
    └── scenes/
        ├── GameScene.js      # ~900 lines. Main gameplay scene.
        ├── GameOverScene.js  # Results + S/L/R navigation
        ├── StoreScene.js     # Browse/buy weapons + mods + skins
        └── LoadoutScene.js   # Equip weapons + equipment + skin before a run
```

---

## 5. Architecture

### 5.1 Phaser game lifecycle

`src/main.js` creates one `Phaser.Game` instance with:

- Canvas size: `800 × 600` (from `CFG.arena`)
- Background: `#1a1a1a`
- Mount: `parent: 'game'` (the `<div id="game">` in `index.html`)
- Physics: Arcade Physics, no debug
- Scenes registered in order: `[GameScene, GameOverScene, StoreScene, LoadoutScene]`

Phaser owns the requestAnimationFrame loop. Each scene has `create()` (one-time setup) and `update(time, delta)` (per-frame). No custom main loop.

### 5.2 Scene graph

```
                       ┌──────────────────────────────────────────────┐
                       │              StoreScene                      │
                       │    browse + buy weapons/mods, ←─ B/Esc       │
                       └──────────▲───────────────────────▲───────────┘
                                  │ S                     │
                                  │                       │
┌─────────────┐   die     ┌───────┴───────┐   L           │
│  GameScene  │ ────────▶ │ GameOverScene │ ──────────────┘
│ (gameplay)  │           │  S / L / R    │ ──────────────┐
└──────▲──────┘    R      └───────┬───────┘               │ L
       │                          │                       ▼
       │                          │             ┌─────────────────────┐
       └──────────────────────────┴────────────▶│   LoadoutScene      │
                            Enter (start run)   │ pick weapon + 2 mods │
                                                └─────────────────────┘
```

Notes:
- After death, `GameScene.endGame()` schedules a 400ms `delayedCall` then transitions to `GameOverScene` with `{score, wave, coinsEarned}`.
- `GameOverScene.init(data)` persists the run **once** via `Save.recordRun()`. If you navigate back from Store/Loadout, the scene is re-entered with `data.persisted=true` so it won't double-credit.
- `LoadoutScene` writes the loadout to save on `Enter` then starts `GameScene`.
- `GameScene` reads the current loadout in `create()` to build its `runtime` stats.

### 5.3 Per-frame data flow in `GameScene.update(time, delta)`

```
if gameOver → return
if cheatPromptActive → return       (input handled by keydown listener)

if (pauseP or pauseEsc just-down) → togglePause()
if paused → return

updateAim()              # rotate barrel toward pointer
handleMovementAndDash()  # WASD → velocity, dash override
handleFire()             # weapon-aware firing (burst-aware)
updateEnemies()          # swarmer = chase; dasher = state machine
updateBullets()          # boomerang return, homing curve
updateCoins(delta)       # magnet to player when in radius
despawnExpiredBullets()  # off-screen or past lifetime
maybeDecayCombo()        # reset combo after timeout
updateShield()           # follow player, expiry check
updateHUD()              # text refresh, dash cooldown, shield timer
```

Phaser physics step (overlap callbacks) fires between scene update calls:
- `bullets × enemies` → `onBulletHitEnemy`
- `player × enemies` → `onPlayerHitEnemy`
- `player × coins` → `onPlayerCoin`
- `player × bonusPickup` → `pickupBonus`
- `player × shieldPickup` → `pickupShieldBonus`

### 5.4 Runtime stats (mod effects)

On `GameScene.create()`, the scene reads `Save.get().loadout`, fetches the weapon definition from `catalog.js`, runs all equipped mods' `apply()` functions to mutate a stats context, then computes a `this.runtime` object used throughout gameplay:

```js
this.runtime = {
  maxHp:            CFG.player.hp + modStats.maxHpDelta,
  playerSpeed:      CFG.player.speed * modStats.moveSpeedMult,
  dashCooldownMs:   CFG.player.dashCooldownMs * modStats.dashCooldownMult,
  bulletSpeed:      CFG.bullet.speed * modStats.bulletSpeedMult,
  bulletLifetimeMs: CFG.bullet.lifetimeMs * modStats.bulletLifetimeMult,
  fireRateMult:     modStats.fireRateMult,
  coinDropMult:     modStats.coinDropMult,
  magnetRadius:     CFG.coin.magnetRadius * modStats.magnetRangeMult,
  comboResetMs:     CFG.combo.resetMs + modStats.comboResetMsDelta,
  luckyChance:      modStats.luckyChance,
};
this.phoenixCharges = modStats.phoenixCharges;
```

This single object replaces hard-coded `CFG.*` references throughout the scene wherever mods can alter the value.

---

## 6. Game subsystem reference

Each subsection describes one logical system, the data it owns, and the methods that drive it. All inside `GameScene.js` unless noted.

### 6.1 Player movement

- Visual: a blue `Arc` (radius 14, `CFG.player.color = 0x4fc3f7`) at center on spawn.
- Aim indicator: a small white rectangle (`barrel`, 10×4) at the player's position; rotates each frame to face the mouse pointer.
- Physics: Arcade body with `setCircle(radius)` and `setOffset(-radius, -radius)`. Collides with world bounds.
- Movement: `handleMovementAndDash(time)` reads `WASD`/`arrows`, computes intent vector, normalizes diagonals, multiplies by `runtime.playerSpeed`. Sets `body.velocity`.
- Dash (`tryDash`): on `Space` (`JustDown`), if `time >= dashReadyAt`:
  - Direction = current movement intent, or aim direction if standing still
  - Sets `dashEndsAt`, `dashReadyAt`, `invulnerableUntil` (= `dashEndsAt`)
  - Tweens player alpha to 0.4 then back to 1
- While dashing (`time < dashEndsAt`), velocity is overridden to `dashDir * CFG.player.dashSpeed`.

### 6.2 Aiming & firing

- `updateAim()` computes `this.aimAngle = atan2(pointerY - py, pointerX - px)`. Sets `barrel.rotation`.
- `handleFire(time)` decides whether to fire this frame. Firing is gated by `this.player.nextFireAt`.
- Two firing paths:
  - **Burst weapons** (only `burst` so far): when not buffed and there are shots remaining, fire one shot every `intraDelayMs`. After the last shot in the salvo, set `nextFireAt = time + cooldownMs`. Pointer must be down to start a new salvo.
  - **Normal weapons**: when pointer is down and `time >= nextFireAt`, fire all `angles` simultaneously, then `nextFireAt = time + rateMs * runtime.fireRateMult`.
- When the green-bonus buff is active (`buffLevel > 0`), `handleFire` overrides the weapon's `angles` and `rateMs` with `CFG.bonus.levels[buffLevel]` values. `fireRateMult` from mods still applies.

`fireBullet(time, offsetDeg)` spawns one bullet:
- Position: player position + aim direction × (player radius + 4)
- Velocity: `(cos(angle), sin(angle)) * runtime.bulletSpeed * speedMult`
- Lifetime: `runtime.bulletLifetimeMs` unless overridden by `lifetimeMsOverride` in weapon's `bulletMods`
- Size: `CFG.bullet.radius * sizeMult` (plasma uses 2.5×)
- Color: yellow normally, orange (`0xff7043`) if `aoeRadius` set (plasma)
- Attaches `bulletMods` to the bullet for per-frame behavior (boomerang, homing, piercing, AOE)
- `bullet.isHomingSecond = true` only for the `+offsetDeg` bullet of Twin Pulse

### 6.3 Weapons

Defined in `src/catalog.js` as `WEAPONS` array. Each has:

```js
{
  id, name, tier, price, description,
  fire: {
    rateMs,                 // ms between shots
    angles,                 // [deg] for each bullet
    burst?: { count, intraDelayMs, cooldownMs },
    bulletMods?: {
      piercing,             // bullet not destroyed on enemy hit
      returningAfterMs,     // boomerang: reverse velocity at this age
      homingSecondShot,     // twin pulse: second bullet curves toward nearest enemy
      aoeRadius,            // plasma: kill nearby enemies on hit
      sizeMult,             // visual + body size multiplier
      speedMult,            // bullet speed multiplier
      lifetimeMsOverride,   // hard override of lifetime
    }
  }
}
```

Per-frame bullet handling lives in `updateBullets(time)` and `onBulletHitEnemy(bullet, enemy)`. See §7 for the full catalog.

### 6.4 Green-bonus ladder (tiered fire-rate power-up)

State: `this.buffLevel ∈ {0, 1, 2, 3}`.

`CFG.bonus.levels` is an array indexed by buff level. Each entry has `{ fireRateMs, angles, barrelColor, label }`.

| Level | Trigger | Fire | Pattern | Barrel | Label |
|---|---|---|---|---|---|
| 0 | start / fully dropped | (weapon's own rate) | (weapon's own angles) | white | — |
| 1 | 1st green collected | 200ms | `[0]` | light green (0x69f0ae) | LVL 1 |
| 2 | 2nd | 120ms | `[0]` | bright green (0x00e676) | LVL 2 |
| 3 | 3rd | 120ms | `[-30, 0, 30]` (tri-spread) | magenta (0xff4081) | LVL 3 |

Mechanics:
- The pickup is a pulsing green circle (`CFG.bonus.color = 0x4caf50`, radius 12) with white outline.
- Spawn cadence: random `60000-120000ms` from `scheduleNextBonus()`. Only one on the arena at a time.
- Lifetime on the arena: 6000ms; last 1500ms it blinks alpha to warn.
- `pickupBonus()`: increments `buffLevel` up to `levels.length - 1`, calls `applyBuffVisuals()` (updates barrel color + HUD `★ LVL N ★` text).
- `stepDownBuff()`: decrements one level. Called from the unshielded path of `onPlayerHitEnemy()`. HP is also lost on the same hit.

### 6.5 Shield (gold star pickup)

State: `shieldActive` (boolean), `shieldHitsRemaining`, `shieldEndsAt`, `shieldRing` (visual).

Pickup:
- Visual: gold 5-point star (`Polygon`, outer 14 / inner 6, color `0xffd54f`). Rotates 3s/rev. Scale pulse 0.9↔1.15.
- Same spawn cadence as green bonus (60-120s), 6s arena lifetime, last 1.5s alpha-blink warning.
- `pickupShieldBonus()` calls `activateShield()`.

Active state:
- `shieldHitsRemaining = CFG.shieldBonus.maxHits` (5)
- `shieldEndsAt = time + CFG.shieldBonus.durationMs` (20000)
- A gold stroked circle `shieldRing` is created around the player; tracked in `updateShield(time)`.
- HUD shows `🛡 SHIELD  hits: N/5  Xs` centered under the wave banner.

Hit handling in `onPlayerHitEnemy`:
- If `shieldActive`, enemy is destroyed, `shieldHitsRemaining--`, ring flashes, brief invulnerability set, no HP loss, no buff loss. If `hits <= 0`, `endShield()`.
- Otherwise (no shield), normal damage path: `stepDownBuff()`, `hp--`, combo→1, hit-flash tween, camera shake, etc.

Expiry:
- `updateShield(time)` checks `time >= shieldEndsAt` and calls `endShield()`, which fades + destroys the ring.

### 6.6 Enemies: swarmer

- Visual: red `Arc` (radius 12, color `0xe53935`).
- AI: `updateEnemies()` per frame sets velocity = unit vector from enemy to player × `enemy.speed`.
- `enemy.speed` is set at spawn from `this.enemySpeedThisWave`, which is `CFG.enemy.speed + CFG.waves.enemySpeedGrowth * (wave - 1)`.
- HP: `CFG.enemy.hp` = 1 (one-shot kill).
- Spawn: from a random arena edge, just outside world bounds, via `pickSpawnEdge()` + `createSwarmer(x, y)`.
- `enemy.type === 'swarmer'`.

### 6.7 Enemies: dasher

- Visual: forest-green `Arc` (radius 12, color `0x2e7d32`).
- Appears from wave `CFG.dasher.appearFromWave = 20+`, replacing `CFG.dasher.spawnRatio = 0.25` of spawns.
- Walks at `0.5 × this.enemySpeedThisWave` (`CFG.dasher.walkSpeedFactor`).
- Periodically dashes:
  - Cooldown: random `3000-5000ms` between dash attempts.
  - On trigger: 400ms windup (enemy stops, flashes white every 80ms).
  - Dash: aim at player's position at that moment, velocity = `CFG.dasher.dashSpeed * direction` (600 px/s), for `CFG.dasher.dashDurationMs = 150ms`. After, return to walking, new cooldown.
- State on enemy: `enemy.windupEndsAt`, `enemy.dashEndsAt`, `enemy.nextDashAt`, `enemy.baseColor`.
- HP: 1.
- `enemy.type === 'dasher'`. `updateEnemies` dispatches to `updateDasher(enemy, px, py, now)`.

### 6.8 Wave system

State: `this.wave`, `this.pendingSpawns`, `this.enemySpeedThisWave`, `this.activeSpawnEvent`, `this.nextWaveScheduled`, `this.nextWaveDelayedCall`.

Flow:
1. `startNextWave()`:
   - `this.wave += 1`
   - `count = CFG.waves.baseCount + CFG.waves.growthPerWave * (wave - 1)`
   - `enemySpeedThisWave = CFG.enemy.speed + CFG.waves.enemySpeedGrowth * (wave - 1)`
   - `pendingSpawns = count`
   - Schedules a `time.addEvent({ delay: spawnIntervalMs, repeat: count - 1, callback: spawnEnemy })`. Stores ref in `activeSpawnEvent`.
   - Shows a "WAVE N" banner that fades out.
2. `spawnEnemy()`:
   - Picks edge, rolls dasher chance, calls `createSwarmer` or `createDasher`.
   - Decrements `pendingSpawns`.
3. `maybeStartNextWave()` is called whenever an enemy dies (in `onBulletHitEnemy` and the unshielded path of `onPlayerHitEnemy`):
   - Returns early if `gameOver`, `pendingSpawns > 0`, `enemies.countActive() > 0`, or `nextWaveScheduled`.
   - Else: `payWaveClearBonus()`, then `nextWaveDelayedCall = time.delayedCall(interWaveDelayMs, startNextWave)`.

Wave-clear coin bonus: `payWaveClearBonus()` adds `(25 + 10 × wave) × runtime.coinDropMult` coins, shows floating gold "+N ¢" text.

### 6.9 Combo multiplier

- `this.comboMultiplier ∈ [1, CFG.combo.maxMultiplier]` (capped at 50 by default).
- On kill (in `killEnemyScoring(x, y)`):
  - `comboMultiplier = min(comboMultiplier + 1, maxMultiplier)` (`comboUp` SFX fires on each step up to the ceiling)
  - `lastKillAt = time.now`
  - `score += scorePerKillBase * comboMultiplier` (score scales the full way to x50)
  - `dropCoinsForKill(x, y)` spawns coins
- **Effect-scaling clamp:** kill-burst shards (`spawnKillBurst`) and per-kill coins (`dropCoinsForKill`) scale on `min(comboMultiplier, CFG.combo.effectScaleCap) − 1` (cap 8), so visuals/economy stop growing past x8 while the multiplier and score keep climbing to x50.
- On player damage (unshielded): `comboMultiplier = 1`.
- `maybeDecayCombo(time)`: if `comboMultiplier > 1 && time - lastKillAt > runtime.comboResetMs` (default 2500ms, +1000ms with Combo Glove mod), reset to 1.
- The "Combo Adept" tiered achievement (`src/achievements.js`) rewards x5/x8/x16/x50 — the Diamond tier matches the cap.

### 6.10 Coins & economy

Physics group: `this.coins`. Each coin is a small yellow circle (`CFG.coin.radius = 4`, color `0xffd54f`) with a thin white outline.

Drop on kill — `dropCoinsForKill(x, y)`:
```
base = 1 + (min(comboMultiplier, CFG.combo.effectScaleCap) - 1)   // 1 at x1, 8 at x8+ (clamped)
amount = round(base * runtime.coinDropMult)
if runtime.luckyChance > 0 and Math.random() < luckyChance:
  amount *= 2
spawnCoins(x, y, amount)
```

`spawnCoins(x, y, n)`: spawns `n` coins at `(x, y)` with random direction, initial speed `CFG.coin.dropSpeed * (0.6-1.4)`.

Per-frame magnet — `updateCoins(time, delta)`:
- For each coin, distance to player.
- If within `runtime.magnetRadius` (default 150, ×1.5 with Magnet Boots = 225), apply acceleration `CFG.coin.magnetAccel = 800 px/s²` toward player.
- Clamp speed to `CFG.coin.maxSpeed = 600`.
- If outside radius, gentle drag (×0.96 per frame).

Collection — `onPlayerCoin(playerSprite, coin)`: destroy coin, `coinsThisRun += 1`, refresh HUD. (Note: each pickup is one coin; the *amount* dropped per kill is the count of individual coin objects spawned.)

HUD: top-center gold text `¢ N` showing `coinsThisRun`.

Wave-clear bonus: see §6.8.

On death: `endGame()` passes `coinsEarned: this.coinsThisRun` to `GameOverScene`. The scene's `init(data)` calls `Save.recordRun({wave, score, coinsEarned})` which adds to wallet + updates stats.

### 6.11 Game over flow

- `endGame()` sets `gameOver = true`, pauses physics, despawns any active bonus/shield pickup, ends shield, then after 400ms transitions to `GameOverScene` with `{score, wave, coinsEarned}`.
- `GameOverScene.init(data)`:
  - If `!data.persisted`: calls `Save.recordRun(...)` to add coins to wallet + update best stats.
  - Stores `walletBefore` / `walletAfter` for display.
  - Sets `passthroughData` (with `persisted: true`) for navigation to Store/Loadout and back.
- `GameOverScene.create()` shows: wave reached, score, `Coins earned: +N`, `Wallet: W1 → W2`, and three action prompts.
- Keys: `R` (RETRY → GameScene), `S` (STORE), `L` (LOADOUT).

### 6.12 Store

`StoreScene`:
- Top: wallet display (`¢ N`).
- Tabs: WEAPONS / EQUIPMENT / SKINS, switched via `Tab` or `←/→`.
- Weapons/equipment grouped by tier (Common, Uncommon, Rare, Epic, Legendary), color-coded.
- For each item: name, price, badge:
  - `[OWNED]` (green) — already bought
  - `[BUY]` (gold) — affordable, not owned
  - `[NEED ¢X]` (red) — too expensive
- Selected item shows its `description` at the bottom of the screen.
- `↑/↓` selects, `Enter` buys (calls `Save.buyWeapon(id, price)` or `Save.buyMod(id, price)`), `B`/`Esc` back to Game Over.
- `R` triggers a reset-save confirmation (`Y` wipes save, `N`/`Esc` cancels).
- Free items (price 0, i.e., the default Pistol) are hidden from the store listing.

**Skins tab** (character skins, `src/skins.js`): a **flat list sorted cheapest → most expensive** (no tier headers). Each row shows the skin's own `south-idle` thumbnail (resolved by `skinThumb()`; placeholder skins without shipped art fall back to the tinted default frame), name, price, and a badge:
- `[EQUIPPED]` (green) — the currently equipped skin
- `[EQUIP]` (cyan) — owned but not equipped; clicking equips it (`Save.equipSkin`)
- `[BUY]` (gold) — affordable; buying (`Save.buySkin`) auto-equips it
- `[NEED ¢X]` (red) — too expensive

The default skin (`default`, "Recruit", price 0) is always owned and is the implicit base look.

### 6.13 Loadout

`LoadoutScene`:
- Five slots: `WEAPON 1`, `WEAPON 2`, `EQUIPMENT 1`, `EQUIPMENT 2`, `SKIN`.
- Navigation: `↑/↓` switches between slots. `←/→` cycles choices in the current slot.
- Weapon slot choices: `save.ownedWeapons` (default has `'pistol'`).
- Mod slot choices: `[null, ...availableMods]` where `availableMods = save.ownedMods.filter(m => m !== otherSlot.mod)`. Same mod cannot be in both slots.
- Skin slot choices: owned skins (`save.ownedSkins`, price-ordered); buy more in the Store's Skins tab.
- Mod slot can be `(empty)` (null).
- `Enter`: persists via `Save.setLoadout(weaponIds, modIds, skinId)`, then `scene.start('GameScene')`.
- `B`/`Esc`: returns to `GameOverScene` with `passthroughData`.

Display per slot:
- Label (▶ on selected slot, gold color)
- Value `< Name >` in the item's tier color
- Description below

### 6.14 Save module

`src/save.js` exports `Save` object with synchronous methods. State cached in module scope.

API:
- `Save.get()` — returns cached state (reads `localStorage` first time, applies defaults for missing fields, falls back to defaults on parse error).
- `Save.set(updater)` — `updater` is a function `prev → next` or a literal object. Writes the whole state as JSON to the single localStorage key.
- `Save.addToWallet(amount)` — convenience.
- `Save.buyWeapon(id, price)` — guard: already owned, can't afford. Updates wallet + `ownedWeapons`.
- `Save.buyMod(id, price)` — same for mods.
- `Save.buySkin(id, price)` — same for skins; updates wallet + `ownedSkins`.
- `Save.equipSkin(id)` — sets `loadout.skin` (only if the skin is owned).
- `Save.setLoadout(weapons, mods, skin)` — updates `loadout` (the `skin` arg is applied only if owned; omitting it keeps the current skin).
- `Save.recordRun({wave, score, coinsEarned})` — adds coins to wallet, updates `bestWave`/`bestScore`/`runsPlayed`/`totalCoinsEarned`.
- `Save.getCheckpointWave()` / `Save.setCheckpointWave(wave)` / `Save.resetCheckpoint()` — boss-checkpoint accessors (`progress.checkpointWave`). `setCheckpointWave` is monotonic, boss-wave-validated, and capped at `CFG.boss.finalWave`.
- `Save.reset()` — wipe to defaults.

Storage key: `arenaFight.save.v1` (version-prefixed for forward compat).

### 6.15 HUD

Built in `createHUD()` (called from `create()`). All text elements use a monospace font.

Layout:
- Top-left: HP pips (one red heart per max HP — filled `hp-heart` when remaining, empty `hp-heart-empty` outline when lost; a just-lost heart flashes — `renderHpPips()`, tuned by `CFG.hud.hpPips`) and `Score: N` (two lines)
- Top-right: `Wave: N` and `Combo: xN`
- Top-center: `¢ N` (coins this run, gold)
- Below top-center: `★ LVL N ★` (green-bonus indicator, hidden when `buffLevel === 0`)
- Below that: `🛡 SHIELD  hits: H/M  Ts` (shield indicator, hidden when no shield)
- Bottom-center: `dash cooldown: X.Xs` or `dash ready  [space]`

Other UI elements created in `createHUD()`:
- Pause menu (`buildPauseMenu()`) — a full-canvas dimmed overlay with a centered button column (see §6.16)
- `cheatBg` / `cheatTitle` / `cheatInput` / `cheatHint` — backtick console overlay (see §6.17)
- `waveBanner` — created in `startNextWave()`, lives 1800ms

`updateHUD(time)` called every frame from `update()` (also called once at end of `createHUD()` to initialize text).

### 6.16 Pause

- `togglePause()` toggles `this.paused`, calls `this.physics.pause()`/`.resume()`, sets `this.time.paused`, and shows/hides the pause menu via `setPauseMenuVisible()`.
- `update()` returns early if `this.paused` (gameplay + firing frozen); `onPointerDown()` likewise ignores taps while paused, so input never bleeds through to the arena.
- **Pause menu** (`buildPauseMenu()`, built once in `createHUD()`, laid out in `layoutPauseMenu()` from `layoutHud()` so it recenters on resize). A dimmed full-canvas backdrop (depth `CFG.pause.depth`, default 1400) plus a centered button column: **RESUME** → `togglePause()`, **RESTART RUN** → `scene.start('GameScene')`, **SETTINGS** → inline audio sub-panel, **QUIT TO MENU** → `exitToMainMenu()`. Reuses the MainMenu rounded-rect/caret button look (`drawPauseButton`).
- Navigable by keyboard (Arrow/`W`/`S` move + `Enter`/`Space` activate, handled in `onKeyDown`), mouse (zone `pointerover`/`pointerdown`), and touch (the on-screen MENU button toggles pause; the overlay's own zones are tappable). `P`/`Esc` resume (handled in `update()`); in the settings sub-panel `P`/`Esc` backs out to the button list first.
- **Settings sub-panel** (`pauseView === 'settings'`): inline **MUSIC** and **SOUND** toggles (`Save.setMusicEnabled`/`Save.setSfxEnabled` + `syncMusic`) and a **‹ BACK** row, so players can change audio without dying. (Screen-shake toggle is a future add-on — see `plan_docs/ui_ux_top10_prompts/ui_ux_task6.md`.)
- Tuning lives in `CFG.pause` (button size/gap, offsets, backdrop alpha, depth, accent color).
- All `time.addEvent` and `time.delayedCall` events naturally pause along with `this.time.paused = true`, so bonus/shield/wave timers all freeze correctly.
- The cheat console hides the pause overlay (`setPauseMenuVisible(false)`) while open and restores it on close if the game was already paused (`preCheatPaused`).

### 6.17 Dev-only cheat console: jump to wave / add coins (backtick)

The cheat console is gated by `import.meta.env.DEV`, so it is available during `npm run dev` and disabled in production builds such as GitHub Pages.

`onKeyDown(event)` registered as `this.input.keyboard.on('keydown', ...)` in `create()`.

Flow:
- Backtick (`` ` ``) toggles the prompt.
- When open: `cheatPromptActive = true`. The scene's `update()` returns early — physics + timers paused (preserving any prior pause via `preCheatPaused`).
- Digits `0-9` (max 3) append to `cheatBuffer`. `Backspace` deletes one. `Escape` cancels.
- `Enter` calls `submitCheat()` → `jumpToWave(N)`.
- `jumpToWave(N)`:
  - Cancels `activeSpawnEvent` (the current wave's spawn timer)
  - Cancels `nextWaveDelayedCall` (any pending next-wave schedule)
  - Resets `nextWaveScheduled = false`
  - Clears all enemies + bullets
  - Destroys wave banner if present
  - `wave = N - 1`, `pendingSpawns = 0`, then `startNextWave()` (which increments to N)
- Bonus and shield pickup timers are intentionally not cancelled (they keep their cadence).

### 6.18 Phoenix revive

If the player has the Phoenix mod equipped, `phoenixCharges` starts at 1 for the run.

On lethal hit (HP reaches 0 in the unshielded path of `onPlayerHitEnemy`):
- If `phoenixCharges > 0`: decrement charges, set `hp = 1`, call `activateShield()` (full 5-hit / 20s shield), show "PHOENIX" floating text. Game continues.
- Else: `endGame()`.

This is the only mod with non-stat-mutating behavior.

### 6.19 Bosses (per-wave archetypes)

Large, multi-phase bosses appear on every boss wave (`CFG.boss.everyNWaves`, default 10 → waves 10, 20, 30, …). Each boss wave runs a different **archetype** with its own colours, weak-point counts, and move set; the final boss (**The Annihilator**) is at `CFG.boss.finalWave` (100). All tuning is in `CFG.boss`.

- **Wave flow:** `startNextWave()` calls `isBossWave(n)`; on a boss wave it calls `startBossWave(n)` instead of the normal spawn cadence — no edge spawns happen, the boss summons its own adds. `tier = floor(n / everyNWaves)` (1 at wave 10 … 10 at wave 100). The wave does not advance until the boss (and its adds) are cleared, which works for free because `maybeStartNextWave()` gates on `enemies.countActive() > 0` and the boss is a normal member of `this.enemies`.
- **Variants & scaling:** `CFG.boss.variants[]` holds 10 archetypes (index 0 = wave 10 … 9 = wave 100); `bossVariant(tier)` clamps, so tiers past 10 repeat the final boss. Each variant defines `name`, palette (`body`/`accent`/`core`/`proj`), `weakPointsByPhase`, and `phasePowers` (which powers are active in each phase). Variants with generated art also define an `id` used by `BOSS_SPRITES`. Difficulty scales **continuously** with tier: HP (`baseHp`+`hpPerTier`), shield (`baseShield`+`shieldPerTier`), attack cadence (`bossCadence`), projectile speed (`bossProjSpeed`), move speed, and weak-point orbit speed all grow with tier.
- **Rendering:** the wave-10 Warden and wave-20 Juggernaut each use 21-frame art sets; the wave-30 Hexweaver and wave-40 Bombardier each use 23 frames; the wave-50 Phantom, wave-60 Overlord, wave-70 Tempest, and wave-80 Colossus each use 25 frames; the wave-90 Voidcaller uses 27 frames. These sets cover eight directional idle poses, four movement frames, telegraph/release power pairs, enrage, and four death frames. `GameScene` preserves world-space collision size while scaling 256×256 sprites, delays art-backed powers through their telegraphs, and blocks additional casts until the pending release fires. Charge frames lock across the existing windup and lunge states. Other variants retain the palette-tinted `Arc` fallback. Shield rings and orbiting weak points remain independent code-drawn overlays.
- **Hexweaver phase 2:** `mirrorClones` summons two one-hit Rune Prowlers rather than primitive circles. Each uses one of eight player-facing 256×256 frames from `public/assets/enemies/boss/hexweaver/rune-prowler/`, scaled while preserving the configured 26px collision radius. Existing range movement, firing cadence, expiry, and projectile behavior are unchanged; pulse tweens are explicitly removed during cleanup.
- **Damage model (`damageBoss`):** a hit within a weak point's `hitRadius` always damages HP (×`weakPoint.damageMult`), bypassing the shield. Otherwise, if `shieldUp`, the hit chips the shield (shatters at 0); once down, hits damage HP. The shield is restored to full at each new phase. Piercing bullets are throttled per-bullet (`pierceHitCooldownMs`).
- **Phases (3, escalating):** `bossTryPhaseChange` advances at `phaseThresholds` (66% / 33%). On transition: restore shield, brief idle window (`transitionMs`), reconfigure weak-point count, reset power timers (`resetBossPowerTimers`), camera flash/shake.
- **Powers (`updateBoss` → `castBossPower`):** the boss casts whichever powers its variant lists for the current phase, each on its own scaled cooldown (`bossPowerCooldown`). Power library (`CFG.boss.powers`): `summon` (wave-gated adds — see below), `barrage` (radial spread), `spiral` (rotating arms), `aimedVolley` (fan aimed at the player), `charge` (windup → lunge → `bossSlam` shockwave), `nova` (telegraphed AoE ring), `beamSweep`, `mirrorClones`, `gravityWell`, `dotField`, `missiles`, and `shieldSlam` (re-raise a broken shield).
- **Wave-gated summons:** `bossSummonPool(wave)` returns only enemy types whose `appearFromWave` is **strictly below** the boss's wave, so a wave-20 boss can summon wave-1…19 enemies but nothing from wave 20+. A wave-10 boss can only summon swarmers.
- **Contact:** `onPlayerHitEnemy` never destroys the boss — it only damages the player.
- **Death:** `damageEnemy → killBoss → onEnemyKilled('boss')` pays the scaled coin reward (`payBossReward`), plays generated death frames when available plus the code-drawn burst, clears remaining adds (`clearBossAdds` if `clearAddsOnBossDeath`), **records the boss checkpoint** (`Save.setCheckpointWave(this.wave)` — done here, not in `teardownBossState`, so only a genuine kill advances it), and tears down boss state/HUD (`teardownBossState`). `jumpToWave` also calls `teardownBossState` (but not `setCheckpointWave`).

The boss is **not** in `ENEMY_TYPE_ORDER`, so `pickEnemyType()` never spawns it during normal waves; it is only created by `startBossWave()`. The bestiary uses real south-facing Warden, Juggernaut, Hexweaver, Bombardier, Phantom, Overlord, Tempest, Colossus, and Voidcaller portraits.

### 6.20 Onboarding (interactive scripted tutorial)

Implements task 1 of `plan_docs/improvments_task1.md`. A fully scripted,
step-by-step interactive tutorial that lives **only** in the tutorial flow (there
are no hints during a normal run). Reuses `GameScene` via a `{ tutorial: true }`
flag — no new scene.

- **Script + sequencer** (`src/tutorial.js`, framework-agnostic, unit-tested):
  `TUTORIAL_SCRIPT` is the prepared, ordered list of steps (`move`, `aim-fire`,
  `dash`, `combo`, `coin`, `gift`, `shield`, `boss`), each with `title`, `body`,
  `task`, `success`, and a `goal` (`{type, amount}`). `class TutorialController`
  drives the `explain → act → (next) → done` state machine via `acknowledge()`
  and `complete()`.
- **Per-step flow in `GameScene`:** `startTutorial()` builds the controller, marks
  `Save.markTutorialSeen()`, and disables waves / random pickups. Each step:
  `enterTutorialStep()` freezes the arena (`physics.pause()` + `tutorialFrozen`)
  and shows the explanation panel; the player acknowledges (SPACE/ENTER/click →
  `acknowledgeTutorial()`); `setupTutorialGoal()` spawns the scenario (stationary
  target dummies for `kill`/`combo`, coins for `coin`, a forced gift/shield for
  those steps) and shows the objective; `updateTutorial()` polls
  `checkTutorialGoal()` each frame; on success `completeTutorialStep()` shows a
  toast, advances, and re-freezes. `finishTutorial()` shows the completion panel.
- **Invulnerable & isolated:** the player can't die (`onPlayerHitEnemy` and
  `damagePlayer` no-op in tutorial; targets survive contact and die only to
  bullets, which drives the kill/combo steps). Coins/gift/shield are illustrative
  — `onPlayerCoin` counts but doesn't credit the wallet; `endShield` pays nothing.
  `maybeStartNextWave`, `dropCoinsForKill`, `scheduleNextGift/ShieldBonus` all
  early-return in tutorial. Exit any time with `Esc` (→ `exitToMainMenu`, which
  skips `Save.recordRun` for a tutorial).
- **Entry point:** launched only from `MainMenuScene`'s `TUTORIAL` action
  (shortcut `T`) — there is no auto-launch (START/RETRY go straight to a normal
  run). Per-step pacing: each completed step shows a praise word and holds for 2s
  (`TUTORIAL_STEP_DELAY_MS`) during which the **arena stays live and the player can
  keep moving**; the next explanation panel (which freezes the arena) appears when
  the window elapses. The combo step requires destroying all 3 targets.

Persistence: `Save.tutorialSeen` (set on start; see §9).

---

## 7. Catalog: weapons & mods

Defined in `src/catalog.js`. Each item has `id`, `name`, `tier`, `price`, `description`. Weapons have `fire`. Mods have `apply(ctx)`.

### 7.1 Tier color codes (UI)

```js
TIER_COLORS = {
  common:    '#aaaaaa',
  uncommon:  '#4caf50',
  rare:      '#2196f3',
  epic:      '#ab47bc',
  legendary: '#ffb300',
}
```

### 7.2 Weapons (10 total, 1 free starter)

| ID | Name | Tier | Price | Fire (rate, angles, mods) |
|---|---|---|---|---|
| `pistol` | Pistol | common | **0** (default) | 500ms, `[0]` |
| `burst` | Burst | common | 110 | burst: 3 shots, 100ms apart, 600ms cooldown, `[0]` |
| `shotgun` | Shotgun | uncommon | 280 | 800ms, `[-40,-20,0,20,40]`, lifetime override 350ms (short range) |
| `spread` | Spread | uncommon | 340 | 400ms, `[-25,0,25]` |
| `rapid` | Rapid | rare | 650 | 130ms, `[0]` |
| `sniper` | Sniper | rare | 780 | 1200ms, `[0]`, **piercing** + speed ×1.6 |
| `boomerang` | Boomerang | epic | 1400 | 700ms, `[0]`, **returningAfterMs: 500**, **piercing** |
| `beam` | Beam | epic | 1700 | 60ms (fast-fire fallback), `[0]`, speed ×1.4, lifetime 600ms |
| `plasma` | Plasma Cannon | legendary | 3400 | 1500ms, `[0]`, **aoeRadius: 60**, size ×2.5, speed ×0.7 |
| `twin-pulse` | Twin Pulse | legendary | 4200 | 250ms, `[-8,8]`, **homingSecondShot** (the +8° bullet curves toward nearest enemy) |

Notes on exotic behaviors (implementation details):
- **Piercing** (`mods.piercing`): in `onBulletHitEnemy`, don't `destroy()` the bullet. It continues until lifetime expires.
- **Returning** (`mods.returningAfterMs`): in `updateBullets`, after bullet age ≥ delay, set `bulletReturned=true` and reverse velocity. Boomerang also has `piercing` to hit on both legs.
- **AOE** (`mods.aoeRadius`): in `onBulletHitEnemy`, also destroy + score all enemies within `aoeRadius` of the hit point. Visual: a fading orange circle.
- **Homing** (`mods.homingSecondShot`): for the `+offsetDeg` bullet (e.g. Twin Pulse's second bullet), in `updateBullets`, find nearest enemy and lerp velocity toward target with turn rate ~0.08.
- **Burst** (`fire.burst`): a salvo state machine in `handleFire`. `burstShotsRemaining` decrements per intra-shot. When the green buff is active, burst weapons defer to the buff's pattern instead.

### 7.3 Mods (11 total)

Each mod's `apply(ctx)` mutates the runtime stats context (initialized with multipliers=1 and deltas=0).

| ID | Name | Tier | Price | Effect |
|---|---|---|---|---|
| `quick-draw` | Quick Draw | common | 80 | `fireRateMult *= 0.9` (-10% fire rate) |
| `pocket-wallet` | Pocket Wallet | common | 120 | `coinDropMult *= 1.2` (+20% coins) |
| `stride` | Stride | common | 100 | `moveSpeedMult *= 1.1` (+10% move) |
| `steel-plate` | Steel Plate | uncommon | 260 | `maxHpDelta += 1` (+1 max HP) |
| `magnet-boots` | Magnet Boots | uncommon | 230 | `magnetRangeMult *= 1.5` (radius 150→225) |
| `combo-glove` | Combo Glove | rare | 540 | `comboResetMsDelta += 1000` (window 2500→3500ms) |
| `extra-dash` | Extra Dash | rare | 700 | `dashCooldownMult *= 0.5` (800→400ms) |
| `eagle-eye` | Eagle Eye | epic | 1200 | bullet speed +25%, lifetime +25% |
| `glass-cannon` | Glass Cannon | epic | 1500 | -1 max HP, +40% fire rate (`fireRateMult *= 1/1.4`) |
| `lucky-charm` | Lucky Charm | legendary | 2800 | `luckyChance = 0.1` (10% chance for double coin drops) |
| `phoenix` | Phoenix | legendary | 3800 | `phoenixCharges += 1` (revive once per run with shield) |

Mods stack multiplicatively where both touch the same multiplier. Stacking the same mod twice is impossible (only one copy per item; loadout disallows the same mod in both slots).

### 7.4 Helpers exported from catalog

```js
WEAPONS_BY_ID[id]      // lookup
MODS_BY_ID[id]
getWeapon(id)          // fallback to pistol if id unknown
getMod(id)             // returns null if id is null/unknown
buildRuntimeStats(modIds)  // returns {fireRateMult, moveSpeedMult, ...}
TIERS                  // ['common','uncommon','rare','epic','legendary']
TIER_COLORS
```

---

## 8. Config reference (CFG)

`src/config.js` exports a single `CFG` object. All values below are the **current defaults** — these are the truth source, not the design plans. Edit here, Vite HMRs the change.

```js
CFG = {
  player: {
    speed: 220,           // px/s walking
    hp: 3,                // starting HP (before mods)
    radius: 14,
    color: 0x4fc3f7,      // light blue
    fireRateMs: 500,      // base pistol rate (also used as fallback)
    dashSpeed: 600,
    dashDurationMs: 150,
    dashCooldownMs: 800,
    hitFlashMs: 200,
  },
  bullet: {
    speed: 520,
    radius: 4,
    color: 0xffeb3b,      // yellow
    lifetimeMs: 1200,
  },
  enemy: {                // swarmer
    speed: 60,
    hp: 1,
    radius: 12,
    color: 0xe53935,      // red
    contactDamage: 1,
  },
  dasher: {
    color: 0x2e7d32,      // forest green
    radius: 12,
    hp: 1,
    contactDamage: 1,
    walkSpeedFactor: 0.5,
    dashSpeed: 600,
    dashDurationMs: 150,
    dashCooldownMinMs: 3000,
    dashCooldownMaxMs: 5000,
    windupMs: 400,
    windupFlashMs: 80,
    appearFromWave: 20,
    spawnRatio: 0.25,
  },
  waves: {
    baseCount: 5,                  // wave 1 enemies
    growthPerWave: 3,              // +3 per wave
    spawnIntervalMs: 600,
    interWaveDelayMs: 1500,
    enemySpeedGrowth: 4,           // px/s added per wave to swarmer speed
  },
  combo: {
    resetMs: 2500,
    maxMultiplier: 50,
    effectScaleCap: 8,   // shards/coins stop scaling past this; score keeps scaling
    scorePerKillBase: 100,
  },
  arena: { width: 800, height: 600 },
  coin: {
    radius: 4,
    color: 0xffd54f,
    dropSpeed: 60,
    magnetRadius: 150,
    magnetAccel: 800,
    maxSpeed: 600,
  },
  store: {
    waveClearBase: 25,
    waveClearPerWave: 10,
    coinDropPerKillBase: 1,
  },
  bonus: {                          // green pickups
    spawnDelayMinMs: 60000,
    spawnDelayMaxMs: 120000,
    lifetimeMs: 6000,
    warnLastMs: 1500,
    radius: 12,
    color: 0x4caf50,                // medium green
    edgePadding: 60,
    levels: [
      { fireRateMs: 500, angles: [0],         barrelColor: 0xffffff, label: '' },
      { fireRateMs: 200, angles: [0],         barrelColor: 0x69f0ae, label: 'LVL 1' },
      { fireRateMs: 120, angles: [0],         barrelColor: 0x00e676, label: 'LVL 2' },
      { fireRateMs: 120, angles: [-30, 0, 30], barrelColor: 0xff4081, label: 'LVL 3' },
    ],
  },
  shieldBonus: {
    spawnDelayMinMs: 60000,
    spawnDelayMaxMs: 120000,
    lifetimeMs: 6000,
    warnLastMs: 1500,
    outerRadius: 14,
    innerRadius: 6,
    color: 0xffd54f,                // gold star
    edgePadding: 60,
    durationMs: 20000,              // shield lasts 20s
    maxHits: 5,                     // or 5 absorbed hits
    ringColor: 0xffd54f,
    ringWidth: 3,
    ringRadiusPad: 6,
  },
}
```

---

## 9. Save schema

Storage key: `arenaFight.save.v1`. JSON value:

```json
{
  "version": 5,
  "wallet": 587,
  "ownedWeapons": ["pistol", "burst", "spread"],
  "ownedMods": ["quick-draw", "steel-plate"],
  "ownedSkins": ["default", "ninja"],
  "loadout": {
    "weapon": "spread",
    "weapons": ["spread", null],
    "mods": ["quick-draw", null],
    "skin": "ninja"
  },
  "stats": {
    "runsPlayed": 12,
    "bestWave": 18,
    "bestScore": 8400,
    "totalCoinsEarned": 4321,
    "bestCombo": 8,
    "totalKills": 1840,
    "bossesDefeated": 6
  },
  "achievements": ["first-blood", "wave-10", "boss-slayer"],
  "progress": { "checkpointWave": 20 },
  "tutorialSeen": true
}
```

Defaults on first launch (no key present):

```json
{
  "version": 5,
  "wallet": 0,
  "ownedWeapons": ["pistol"],
  "ownedMods": [],
  "ownedSkins": ["default"],
  "loadout": { "weapon": "pistol", "weapons": ["pistol", null], "mods": [null, null], "skin": "default" },
  "stats": {
    "runsPlayed": 0, "bestWave": 0, "bestScore": 0, "totalCoinsEarned": 0,
    "bestCombo": 0, "totalKills": 0, "bossesDefeated": 0
  },
  "achievements": [],
  "progress": { "checkpointWave": 0 },
  "tutorialSeen": false
}
```

`stats.bestCombo` / `totalKills` / `bossesDefeated` and the `achievements` array
(unlocked achievement ids — definitions live in `src/achievements.js`) are folded in
by `Save.recordRun()` / `Save.unlockAchievements()` at run end. The run-summary panel
on the game-over screen (`MainMenuScene.createGameOverDetails`) reads the per-run
breakdown passed in the game-over payload (`summary`, `newAchievements`), which
`GameScene` accumulates in `this.runStats` during play.

`tutorialSeen` records that the interactive tutorial has been started (launched
from the menu's **TUTORIAL** action; there is no auto-launch). See
§6.20 (Onboarding). Helpers: `markTutorialSeen()`, `resetTutorial()`.

`progress.checkpointWave` is the **boss-checkpoint** field: the highest boss wave
the player has cleared (0 = none). The next run can **CONTINUE** at
`checkpointWave + 1` instead of wave 1. It is set on a confirmed boss defeat
(`GameScene.onEnemyKilled('boss')` → `Save.setCheckpointWave(this.wave)`),
monotonic (never decreases), boss-wave-validated, and capped at
`CFG.boss.finalWave` (100). Accessors: `getCheckpointWave()`,
`setCheckpointWave(wave)`, `resetCheckpoint()`. See §6.x boss death and the menu
CONTINUE/NEW GAME flow (`MainMenuScene`).

Character skins (`src/skins.js`) are cosmetic player-body swaps bought/equipped in
the Store (SKINS tab) and Loadout (SKIN slot). `ownedSkins` lists owned ids
(`'default'` always owned) and `loadout.skin` is the equipped id.

Migrations live in `MIGRATIONS` (keyed by source version): `v1 → v2` collapses the
legacy single-weapon loadout into the two-slot `weapons` array; `v2 → v3` stamps
the version so the deep-merge backfills the new `progress` block; `v3 → v4` remaps
the old flat achievement ids onto the tiered scheme (recomputed from lifetime
stats); `v4 → v5` backfills character skins (`ownedSkins: ['default']`,
`loadout.skin: 'default'`). `CURRENT_VERSION` is **5**.

Resilience: corrupt JSON, missing fields, a `version` newer than `CURRENT_VERSION`,
or a missing migration → fall back to defaults with a `console.warn` (the raw bytes
are backed up to `arenaFight.save.backup` before a migration runs). All known fields
are deep-merged against defaults, so older saves upgrade without a wipe.

---

## 10. Scene transitions

### 10.1 Data passed between scenes

- `GameScene` → `GameOverScene`: `{ score, wave, coinsEarned }`
- `GameOverScene` ↔ `StoreScene`: `passthroughData = { score, wave, coinsEarned, persisted: true }`
- `GameOverScene` → `LoadoutScene`: same `passthroughData`
- `LoadoutScene` → `GameScene`: `{ tutorial: false, startWave }` (loadout itself is in save; `startWave` carries the checkpoint-continue vs new-game intent handed in by the menu)
- `MainMenuScene` → `GameScene`: `{ tutorial, startWave }` (CONTINUE passes `checkpointWave + 1`; START/NEW GAME pass `1`)
- `LoadoutScene` → `GameOverScene` (Back): `passthroughData`
- `StoreScene` → `GameOverScene` (Back): same

### 10.2 Why `persisted: true`

`GameOverScene.init(data)` calls `Save.recordRun()` only if `!data.persisted`. This prevents re-crediting the run when returning from Store/Loadout.

---

## 11. Known issues / Phase 1 caveats

- **No audio.** Deferred to a later phase.
- **No sprites.** Everything is primitive shapes (`Arc`, `Polygon`, `Rectangle`).
- **No real menu screen.** First launch goes directly into GameScene with the default loadout.
- ~~**No tutorial.**~~ Resolved: an interactive, scripted step-by-step tutorial launched from the menu **TUTORIAL** action (you can't die). See §6.20.
- **Beam weapon is fake.** It's a very high fire rate with longer-lived bullets. A true hitscan beam would require dedicated rendering code.
- **Boomerang doesn't hit enemies on the return path** if it gets too fast or off-screen — its body is small. Mostly works in practice.
- ~~**No save migrations.**~~ Resolved: `src/save.js` has a versioned `MIGRATIONS` pipeline (`CURRENT_VERSION` 4) plus a deep-merge backfill, so schema bumps upgrade in place instead of wiping.
- **Cheat key is global.** Pressing backtick during pause or shield-anim works fine, but during the game-over scene there's no equivalent shortcut.
- **Touch settings apply on reload.** Scale mode, multitouch pointer count, and the orientation lock are boot-time decisions; changing the touch-controls mode in Settings takes effect on the next reload (the row is labelled accordingly).
- **The store catalog is hard-coded** in `catalog.js`. No external content / no DLC concept.
- **Lucky Charm's double-drop** doubles the *count* of coin objects spawned, which is more visual chaos but the same coin value (each coin is +1 to `coinsThisRun`).
- **Coin lifetime is unlimited** — they stay on the arena until collected. Could become a perf concern with hundreds of coins; not observed in practice.
- **Glass Cannon vs Steel Plate** can result in `maxHp = 3` (no change) but the order matters internally; runtime stats compute additively so the net is consistent.
- **HP increase from Steel Plate** raises both max and current HP at run start (set to `maxHp`).

---

## 12. How to extend

### 12.1 Add a new weapon

1. Add an entry to `WEAPONS` in `src/catalog.js`:
   ```js
   {
     id: 'my-gun',
     name: 'My Gun',
     tier: 'rare',
     price: 600,
     description: '...',
     fire: { rateMs: 300, angles: [-10, 10] },
   }
   ```
2. If it needs exotic behavior, add a flag to `bulletMods` and:
   - Handle it in `GameScene.fireBullet` (visual/initial physics)
   - Handle it in `GameScene.updateBullets` (per-frame behavior)
   - Handle it in `GameScene.onBulletHitEnemy` (on-hit behavior)
3. No further integration needed — Store and Loadout pick it up automatically (assuming `price > 0`, which makes it appear in the Store).

### 12.2 Add a new mod

1. Add an entry to `MODS` in `src/catalog.js` with an `apply(ctx)` function that mutates the appropriate fields on `ctx`.
2. If you need a new runtime-stats field, also add it to the initial `ctx` object in `buildRuntimeStats(modIds)` AND consume it in `GameScene.create()` when computing `this.runtime`.
3. Where the stat takes effect in gameplay, replace any direct `CFG.*` reference with `this.runtime.<field>`.

### 12.3 Add a new enemy type

1. Add stats to `CFG` (e.g., `CFG.shooter = {...}`).
2. Add `createShooter(x, y)` in `GameScene.js`. Set `enemy.type = 'shooter'` and any per-enemy state.
3. Add a branch in `updateEnemies` dispatching to `updateShooter(enemy, px, py, now)` for the AI.
4. Update `spawnEnemy()` to roll the new type based on wave and ratio.
5. HP > 1 enemies need: track `enemy.hp` and only `destroy()` when it reaches 0 in `onBulletHitEnemy` (currently always destroys on first hit).

### 12.4 Add a new pickup type

Pattern (used for green-bonus and shield):
1. Config block: spawn cadence range, lifetime, warning window, visual params, effect params.
2. State on `GameScene`: pickup reference, despawn/warn event refs, overlap ref, "active effect" state.
3. Methods: `scheduleNextX`, `spawnX`, `pickupX`, `despawnX`, `clearXTimers`, `activateX`, `endX`, `updateX`.
4. Wire in `create()` (initial schedule) and `endGame()` (cleanup).
5. Add to `update()` if per-frame logic is needed.
6. Add a HUD indicator if the active effect needs surfacing.

### 12.5 Tune balance

All numbers live in `src/config.js`. Vite HMRs on save — refresh the browser to apply.

Common knobs:
- Difficulty: `CFG.enemy.speed`, `CFG.waves.enemySpeedGrowth`, `CFG.waves.baseCount`, `CFG.waves.growthPerWave`.
- Player feel: `CFG.player.speed`, `CFG.player.fireRateMs`, `CFG.player.dashCooldownMs`.
- Economy: `CFG.store.coinDropPerKillBase`, `CFG.store.waveClearBase`, `CFG.store.waveClearPerWave`. Item prices in `catalog.js`.
- Pickup frequency: `CFG.bonus.spawnDelayMinMs/MaxMs`, `CFG.shieldBonus.spawnDelayMinMs/MaxMs`.
- Combo: `CFG.combo.resetMs`, `CFG.combo.maxMultiplier`, `CFG.combo.effectScaleCap`, `CFG.combo.scorePerKillBase`.

### 12.6 Add a new scene

1. Create `src/scenes/MyScene.js` extending `Phaser.Scene` with `constructor() { super('MyScene'); }`.
2. Import it in `src/main.js` and add to the `scene: [...]` array.
3. Transition via `this.scene.start('MyScene', dataObject)`. The target's `init(data)` receives the object.
4. Remember to `off('keydown', ...)` in `shutdown()` if you registered listeners — otherwise they leak across scene transitions.

---

## 13. Glossary

- **Wave** — a discrete batch of enemies spawned over `spawnIntervalMs` ticks. Wave N has `baseCount + (N-1)×growthPerWave` enemies.
- **Combo** — multiplier from 1 to 50, incremented per kill, reset on damage or after `runtime.comboResetMs` of no kills. Multiplies score (full range); coin drops and kill-burst visuals scale only up to `CFG.combo.effectScaleCap` (8).
- **Green bonus / power-up ladder** — the green circle pickup. Picking it up steps `buffLevel` up one (cap 3). Getting hit steps it down one (and you also lose HP).
- **Shield (gold star)** — pickup that grants 5 absorbed hits over 20s. Independent of the green bonus.
- **Buff level** — current rung on the green-bonus ladder, drives fire rate + bullet pattern overrides. 0 = use weapon's own stats.
- **Loadout** — the equipped weapon + 2 mod slots. Persisted in save. Read once at `GameScene.create()` into `this.runtime` and `this.weaponDef`.
- **Runtime stats** — derived per-run from base CFG + mods. Stored on `this.runtime`. Replaces direct CFG references for anything mods can modify.
- **Coins this run** — `coinsThisRun`, in-run counter. On death, added to persistent wallet.
- **Wallet** — persistent coin total in save. Spent in Store.
- **Owned** — having an item ID in `ownedWeapons` or `ownedMods` in save.
- **Phoenix charges** — number of revives remaining this run. Starts at 1 if Phoenix mod equipped, else 0.
- **Cheat console** — backtick-triggered overlay to jump to an arbitrary wave. Pauses physics + timers while open.
- **Dasher** — green enemy with a windup→lunge dash pattern. Appears from wave 20+.
- **Swarmer** — basic red enemy. Walks straight at the player.
- **Bonus** in code usually refers to the green fire-rate pickup. The shield pickup is `shieldBonus`.

---

## 14. Quick-start for new contributors / LLMs

If you're picking this up, in priority order:

1. Skim §5 (architecture) and §6 (subsystems).
2. Open `src/config.js` for current tunables.
3. Open `src/catalog.js` for all items.
4. Open `src/scenes/GameScene.js` and look at `create()`, `update()`, and the per-system methods named in §6.
5. Make a small change (tweak a CFG value, add a weapon entry) and verify Vite HMR reflects it.
6. Run the game (`npm run dev`), open `http://localhost:5173`, die quickly, navigate Store→Loadout→back. That covers all major scene transitions.

**Recurring patterns** the codebase uses:
- One physics group per entity type (`enemies`, `bullets`, `coins`).
- `time.delayedCall` for one-shot timers (wave delay, despawns). Reference stored on the scene so it can be cancelled.
- `time.addEvent({delay, repeat, callback})` for repeating timers (wave spawns).
- Overlap callbacks via `physics.add.overlap(a, b, callback, null, this)`.
- Visual feedback via `this.tweens.add({...})` — alpha, scale, position.
- Per-frame UI refresh via `updateHUD(time)`; text elements created in `createHUD()`.
- Pause-safe time via `this.time.paused = true`; all events freeze.

---

*End of codebase overview.*
