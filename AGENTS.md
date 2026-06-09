# Arena Fight — Codex Agent Instructions

## Scope

These instructions apply to the entire repository. Follow them when working as an OpenAI Codex agent in this project.

## Project Overview

Arena Fight is a Phaser 3 + Vite browser game using JavaScript ES modules. The canvas is fixed at `800x600`. The main code lives in `src/`, while browser-served assets live in `public/assets/`.

Important files:

- `src/main.js` registers Phaser scenes.
- `src/scenes/IntroScene.js` shows the first-load intro.
- `src/scenes/MainMenuScene.js` owns the main menu and game-over details.
- `src/scenes/GameScene.js` owns gameplay.
- `src/scenes/StoreScene.js`, `LoadoutScene.js`, `SettingsScene.js`, and `MonstersScene.js` own secondary screens.
- `src/config.js` contains gameplay tuning.
- `src/catalog.js` contains weapons and mods.
- `src/enemies.js` contains enemy sprite metadata and monster-menu copy.
- `src/save.js` contains localStorage persistence.
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

## Coding Guidelines

- Use `rg` for searches.
- Use `apply_patch` for manual file edits.
- Keep edits narrow and avoid unrelated refactors.
- Respect existing user changes in the working tree.
- Do not run destructive git commands such as `git reset --hard` or `git checkout --` unless explicitly requested.
- Prefer existing project patterns over new architecture.
- Keep gameplay values configurable through `src/config.js` where practical.
- Keep persistent state changes centralized in `src/save.js`.
- Keep static images, sprite sheets, and music under `public/assets/...`.
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

1. Check the affected screen at the fixed `800x600` canvas.
2. Ensure text is readable and does not overlap important UI or gameplay.
3. Keep the retro game feel unless the user explicitly asks for a different style.
