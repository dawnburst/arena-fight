# Arena Fight — Codex Agent Instructions

## Scope

These instructions apply to the entire repository. Follow them when working as an OpenAI Codex agent in this project.

## Project Overview

Arena Fight is a Phaser 3 + Vite browser game using JavaScript ES modules. The desktop windowed canvas is fixed at `800x600`; on mobile/touch the game is responsive (fixed height 600, width grows to match the device aspect via `Scale.FIT`) and fullscreen-capable — see `src/viewport.js`. The main code lives in `src/`, while browser-served assets live in `public/assets/`.

Important files:

- `src/main.js` registers Phaser scenes.
- `src/scenes/IntroScene.js` shows the first-load intro.
- `src/scenes/MainMenuScene.js` owns the main menu and game-over details. When a boss checkpoint exists (`Save.getCheckpointWave() > 0`) it shows **CONTINUE** (resume at `checkpointWave + 1`) and **NEW GAME** (fresh wave-1 run, keeps the checkpoint) and surfaces the checkpoint on the death screen. It also renders a "Best" showcase and the end-of-run grey→colour achievement-badge reveal.
- `src/scenes/GameScene.js` owns gameplay, including the boss fights that replace every `CFG.boss.everyNWaves`th wave (default 10) — large, 3-phase, shielded bosses with orbiting weak points that summon their own minions. Each boss wave uses a different archetype from `CFG.boss.variants` (distinct colours/powers, difficulty scaling with the wave; final boss at wave 100), and bosses only summon enemy types from earlier waves. Generated boss art now covers Warden through Tempest; later bosses retain the primitive fallback until their sprite sets land. See `plan_docs/plan-boss.md` for the design and `plan_docs/boss-image-prompts.md` for per-wave sprite prompts. Boss waves also cross-fade the field to a hostile **"hell arena"** background (the `BOSS_BACKGROUND` export in `src/backgrounds.js`, kept out of the Settings picker) in lockstep with the boss music — `enterBossBackground()`/`exitBossBackground()` sit beside every `enterBossMusic`/`exitBossMusic` call — and switch standard player bullets to `CFG.bullet.bossColor` for readability over the dark floor; prompt in `plan_docs/boss-retro-art-prompts.md`.
- `src/scenes/StoreScene.js`, `LoadoutScene.js`, `SettingsScene.js`, `MonstersScene.js`, and `AchievementsScene.js` own secondary screens. The Store has a third **SKINS** tab and the Loadout a fifth **SKIN** slot for character skins.
- `src/scenes/AchievementsScene.js` is the tiered-achievement badge gallery (category tabs, grey-while-locked / colour-when-unlocked badges, tap-to-detail progress bars). `src/achievements.js` holds the tiered/boolean definitions, `evaluateAchievements`, and progress/points helpers (`tierProgress`, `unlockedPoints`, `bestUnlock`, `playerLevel`). Badge images live at `public/assets/achievements/<tierId>.png`; `src/scenes/sceneUtils.js` exposes `addBadge`/`applyBadgeState` (PNG with a drawn-medallion fallback).
- `src/config.js` contains gameplay tuning.
- `src/catalog.js` contains weapons and mods.
- `src/skins.js` contains the character-skins catalog (`SKINS`) — coin-bought cosmetic player-body swaps. Owned/equipped state is `Save.ownedSkins`/`Save.loadout.skin` (`v4 → v5` migration). Non-default skins render as tinted default frames (placeholder) until per-skin art ships under `public/assets/player/skins/<id>/<dir>-<pose>.png` and that skin's `assetsReady` is flipped to `true`; prompts in `plan_docs/skin-image-prompts.md`.
- `src/enemies.js` contains enemy sprite metadata and monster-menu copy.
- `src/save.js` contains localStorage persistence (versioned migrations, `CURRENT_VERSION` 5). Boss checkpoints live in `progress.checkpointWave` (accessors `getCheckpointWave` / `setCheckpointWave` / `resetCheckpoint`); `setCheckpointWave` is monotonic, boss-wave-validated, and capped at `CFG.boss.finalWave`. Recorded on confirmed boss defeat in `GameScene`. The `v3 → v4` migration remaps the old flat achievement ids onto the tiered scheme (recomputed from lifetime stats; `Save.achievements` stays an array of unlocked ids); `v4 → v5` backfills character skins.
- `src/audio.js` owns shared background music loading, setting synchronization, and gameplay sound-effect helpers.

Read `CODEBASE.md` for a broad map, but verify against source before changing behavior because implementation may move faster than the documentation.

## Commands

Run commands from the repo root:

```bash
npm install
npm run dev
npm run build
npm run preview
```

Before finishing any code change, run:

```bash
npm run build
```

If the change is documentation-only, no build is required.

## Workflow & Git Standards

Follow these rules for all development tasks:

- **Branching:** Always create a new branch for every task using best practice naming conventions (e.g., `feat/description`, `fix/description`, `ci/description`, `docs/description`, `refactor/description`). Never work directly on the `main` branch.
- **Logical Commits:** Break your changes into small, logical units. Do not bundle unrelated changes into a single commit.
- **Sign-off:** Every commit must include the Developer Certificate of Origin (DCO) sign-off. Use the `-s` flag with `git commit`.
- **Code Formatting:** This project uses [Biome](https://biomejs.dev/). Before committing, ensure you run `npm run check` to format and lint your changes.
- **CI Maintenance:** If you add new source directories or files that should trigger a full build/test run, ensure you update the `src` filter in `.github/workflows/pr-build.yml`.
- **Security:** Do not store sensitive data in `localStorage`. Follow strict XSS prevention when manipulating the DOM. Validate all external inputs.

## Coding Guidelines

- Use `rg` for searches.
- Use `apply_patch` for manual file edits.
- Keep edits narrow and avoid unrelated refactors.
- Respect existing user changes in the working tree.
- Do not run destructive git commands such as `git reset --hard` or `git checkout --` unless explicitly requested.
- Prefer existing project patterns over new architecture.
- Keep gameplay values configurable through `src/config.js` where practical.
- Keep persistent state changes centralized in `src/save.js`.
- Keep static images, sprite sheets, and music under `public/assets/...`, and load them through `src/assetPath.js` when referencing them from Phaser code.
- Use Phaser scene transitions rather than DOM overlays for in-game screens.

## Documentation Maintenance

Major changes must update the relevant docs in the same work item. Check these files before finishing:

- `CODEBASE.md`
- `README.md`
- `CLAUDE.md`
- `AGENTS.md`

Update them when changing:

- Scene flow, boot order, menus, or game-over behavior.
- Enemy roster, monster-menu details, wave appearance rules, weapons, mods, or power-ups.
- Save schema, wallet persistence, store/loadout logic, or settings.
- Asset locations, generated images, music, sprite dimensions, or loading conventions.
- Development, build, preview, verification, or deployment commands.

If a rule belongs in both Claude and Codex instructions, update both `CLAUDE.md` and `AGENTS.md` together.

## Verification Checklist

For code changes:

1. Run `npm run build`.
2. If a dev server is already running, refresh the local game and sanity-check the affected scene when feasible.
3. Report any verification that could not be run.

For visual changes:

1. Check the affected screen at the desktop `800x600` canvas, and (for layout work) confirm it still reflows on a wider mobile canvas — use `this.scale.width/height` (or `GameScene.arenaW/arenaH`) instead of hard-coded `CFG.arena.width/height`.
2. Ensure text is readable and does not overlap important UI or gameplay.
3. Keep the retro game feel unless the user explicitly asks for a different style.
