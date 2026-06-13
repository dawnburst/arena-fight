# Arena Fight
A browser-based retro arena shooter built with Phaser 3 and Vite. Survive escalating monster waves, collect coins, buy weapons and mods, tune your loadout, and push for a higher wave.

See [`CODEBASE.md`](./CODEBASE.md) for the current implementation map.

## Run

```bash
npm install
npm run dev
```

Vite will print a local URL (default `http://localhost:5173/`) — open it in any modern browser.

## Build a static bundle

```bash
npm run build
npm run preview
```

Production builds use the `/arena-fight/` base path for GitHub Pages. Pushes to `main` deploy `dist` through the GitHub Actions workflow in `.github/workflows/deploy.yml`; configure repository Pages to use `GitHub Actions` as the source.

## Controls

| Action | Key |
|---|---|
| Move | `W` `A` `S` `D` (or arrow keys) |
| Aim | Mouse |
| Fire (hold) | Left mouse button |
| Dash | `Space` |
| Pause / Resume | `P` or `Esc` |
| Menu navigation | Mouse or arrow keys + `Enter` |

## Settings

The Settings menu lets you choose the arena background and control the looping background music:

- Music on/off toggle.
- Volume slider.
- Sound effects on/off toggle.
- Sound effects volume slider.
- Keyboard shortcuts: `M` toggles music, `+` / `-` adjusts volume.
- Gameplay sound effects play for coins, dash, gifts, game over, and Beam/Plasma shots.

## Goal

Survive escalating waves of monsters. Each kill builds your score, coins persist in your wallet, and store upgrades help future runs.

<img width="813" height="600" alt="image" src="https://github.com/user-attachments/assets/33332e4e-fafd-4932-b616-7071bdfd1b82" />

<img width="813" height="600" alt="image" src="https://github.com/user-attachments/assets/1073c2c0-190e-4b4c-a852-dd33de8c9835" />

