# Arena Fight — Claude Code Instructions

## Project Context

Arena Fight is a browser-based Phaser 3 arena shooter built with Vite and JavaScript ES modules. The game uses Phaser scenes for intro, menu, gameplay, store, loadout, settings, and monster reference screens.

Start by reading:

- `CODEBASE.md` for the broad project map. Treat source files as the final authority if the doc is stale.
- `src/main.js` for scene registration and boot order.
- `src/scenes/GameScene.js` for gameplay logic.
- `src/config.js`, `src/catalog.js`, `src/enemies.js`, and `src/save.js` for tuning, inventory, enemy metadata, and persistence.

## Commands

Use these commands from the repository root:

```bash
npm install
npm run dev
npm run build
npm run preview
```

`npm run build` is the required verification command before finishing code changes unless the change is documentation-only.

## Development Rules

- Keep changes scoped to the requested feature or bug fix.
- Preserve user work in the working tree. Do not revert unrelated edits.
- Use existing Phaser scene patterns and config-driven tuning before adding new abstractions.
- Put static game assets under `public/assets/...` and load them through `src/assetPath.js` so production builds work under the GitHub Pages `/arena-fight/` base path.
- **Workflow:** Always create a new branch for any task (e.g., `feat/`, `fix/`, `docs/`, `ci/`) and never commit directly to `main`.
- **Commits:** Break changes into small, logical units and avoid unrelated refactors in the same commit.
- **DCO Sign-off:** Every commit must include the sign-off flag (`git commit -s`).
- **Formatting:** This project uses Biome. Run `npm run check` before committing to ensure code quality and consistent styling.
- **CI Maintenance:** Automatically update the `src` filter in `.github/workflows/pr-build.yml` when adding new source files or configuration that require a full build/test cycle.
- **Security:** Avoid storing sensitive tokens in `localStorage`. Sanitize all user-provided strings before DOM insertion.
- Keep persistent player state in `src/save.js` and avoid creating new localStorage keys unless there is a migration plan.
- Prefer changing `src/config.js` for gameplay tuning values such as wave timing, enemy appearance waves, prices, movement, and coin behavior.
- For visual UI work, keep the game-first retro style and verify text does not overlap at the fixed `800x600` canvas size.

## Documentation Maintenance

When a major change is made, update documentation in the same change. A major change includes:

- Scene flow, menu structure, or boot behavior.
- Save schema, coin persistence, store/loadout behavior, or settings.
- Enemy types, wave appearance rules, weapons, mods, or power-ups.
- Asset pipeline, generated assets, or required public asset paths.
- Run, build, deployment, or verification commands.

At minimum, check whether `CODEBASE.md`, `README.md`, `CLAUDE.md`, and `AGENTS.md` need updates. If the change only affects one agent file, keep the other agent file consistent when the guidance applies to both.

## Current Architecture Notes

- `IntroScene` runs first and transitions to `MainMenuScene`.
- `MainMenuScene` is the single menu and also renders game-over details when reached after death.
- `GameScene` owns gameplay and records completed runs before returning to `MainMenuScene`.
- Store, loadout, settings, monsters, and achievements are separate scenes reached from the main menu.
- Achievements are tiered (Bronze/Silver/Gold/Diamond). `src/achievements.js` defines each achievement as either tiered (`tiers` of ascending targets + `progress(ctx)`, one unlockable id per tier `<id>-N`) or boolean (`check(ctx)` + `points`, a single id). `evaluateAchievements` emits the newly-passing ids; tier metals carry points (Bronze 10 / Silver 25 / Gold 50 / Diamond 100). `AchievementsScene` is a category-tabbed badge gallery: badges are full-colour when unlocked and grey-tinted while locked (one PNG per tier at `public/assets/achievements/<tierId>.png`, with a drawn-medallion fallback via `sceneUtils.addBadge`). `MainMenuScene` adds a "Best" showcase (Best Wave / Best Score / Bosses, rarest badge, achievement level) and animates a grey→colour badge reveal for new unlocks at game over.
- `Save.achievements` stays an array of unlocked ids. Schema is at `CURRENT_VERSION = 4`; the v3→v4 migration remaps the old flat achievement ids onto the tiered scheme (recomputing tier unlocks from the persisted lifetime stats, no unlocks lost). `CFG.achievements.pointsPerLevel` tunes the points→level curve.
- Background music and gameplay sound effects are loaded through `src/audio.js`; music and sound-effect enabled state and volume persist in `Save.settings`.
- `src/viewport.js` owns the responsive scale strategy and fullscreen: desktop windowed stays `Scale.NONE` 800×600 (unchanged); mobile/touch uses `Scale.FIT` with a fixed height (600) and an aspect-matched width so the canvas fills the device with no bars; desktop fullscreen switches to `Scale.FIT`. Use `this.scale.width/height` (or `GameScene.arenaW/arenaH`, updated in `handleResize`) for any centered/right/bottom-anchored layout instead of `CFG.arena.width/height`. Fullscreen defaults off (`Save.settings.fullscreen`) on both desktop and touch; it is opt-in via `F` or the Settings row. When the preference is on, `requestFullscreenIfEnabled` auto-enters on the first Intro tap. `GameScene` reflows live on resize (no restart); menu scenes restart-on-resize. Shared cover-fit background helper: `src/scenes/sceneUtils.js`.
- The saved wallet should survive death; avoid double-crediting coins at game over.
- **Boss checkpoints:** clearing a boss wave records a persistent checkpoint (`Save.progress.checkpointWave`, set via `Save.setCheckpointWave(this.wave)` on confirmed boss defeat in `GameScene.onEnemyKilled('boss')` — monotonic, boss-wave-validated, capped at `CFG.boss.finalWave`). When `checkpointWave > 0`, `MainMenuScene` offers **CONTINUE** (resume at `checkpointWave + 1`) and **NEW GAME** (fresh wave-1 run, which keeps the checkpoint). The start wave flows via `scene.start('GameScene', { startWave })`; `GameScene.create` reads `data.startWave` (default 1) and `beginAtWave()` is shared with the `jumpToWave` cheat. Save schema is at `CURRENT_VERSION` 4; the `v2 → v3` migration backfills `progress` (and `v3 → v4` migrates achievements to the tiered scheme).
- Every `CFG.boss.everyNWaves`th wave (default 10) is a boss wave: `GameScene.startBossWave()` spawns a large, 3-phase, shielded boss (orbiting weak points, summons its own minions) instead of the normal spawn cadence. Each boss wave uses a different archetype from `CFG.boss.variants` (`bossVariant(tier)`), with distinct colours/powers and difficulty scaling with the wave; the final boss is **The Annihilator** at `CFG.boss.finalWave` (100). Bosses can only summon enemy types whose `appearFromWave` is below the boss's wave (`bossSummonPool`). The boss is created only by `startBossWave()` and is not in `ENEMY_TYPE_ORDER`. Phase 1 bosses are primitive composites; per-wave sprite-generation prompts are in `plan_docs/boss-image-prompts.md` (overall design in `plan_docs/plan-boss.md`).
- Boss waves also swap the arena field to a hostile **"hell arena"** background in lockstep with the boss music: `startBossWave()` calls `enterBossBackground()` (cross-fades `hell-arena.png` over the player's selected background across `CFG.boss.transitionMs`) and every `exitBossMusic` site also calls `exitBossBackground()` (`teardownBossState`, `endGame`, `SHUTDOWN`). The hell background is the `BOSS_BACKGROUND` export in `src/backgrounds.js`, kept out of the Settings picker. A `bossBackgroundActive` flag mirrors the music `bossMode`; while set, standard player bullets use `CFG.bullet.bossColor` (light) for readability over the dark floor. Generation prompt: `plan_docs/boss-retro-art-prompts.md`.
