# Arena Fight

A top-down arena shooter for the browser, inspired by *Onslaught! Arena*. **Phase 1 prototype** — primitive shapes, one enemy type, escalating waves, combo scoring, dash. No audio, no art, just feel.

See [`plan-game.md`](./plan-game.md) for the full design and implementation plan.

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

## Controls

| Action | Key |
|---|---|
| Move | `W` `A` `S` `D` (or arrow keys) |
| Aim | Mouse |
| Fire (hold) | Left mouse button |
| Dash | `Space` |
| Pause / Resume | `P` or `Esc` |
| Restart (on game over) | `R` |

## Goal

Survive escalating waves of red swarmers. Each kill builds your combo multiplier and your score. Taking damage resets the combo. Use dash to phase through enemies (brief invulnerability). See how far you can push the wave counter.
