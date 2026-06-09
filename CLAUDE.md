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
- Put static game assets under `public/assets/...` and load them with root-relative paths such as `/assets/intro/intro.png` or `/assets/music/retro_game_music.mp3`.
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
- Store, loadout, settings, and monsters are separate scenes reached from the main menu.
- Background music is loaded through `src/audio.js`; its enabled state and volume persist in `Save.settings`.
- The saved wallet should survive death; avoid double-crediting coins at game over.
