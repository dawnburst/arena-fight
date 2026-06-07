---
name: update-readme
description: Refresh README.md so it reflects the current state of the game. PROACTIVELY use this before any git commit that touches src/, index.html, or package.json — the README's Features, Controls, Enemies, Power-ups, and Tunables sections must always match the code. Idempotent: if the README already matches, exit without writing.
---

# update-readme

Use this skill when:
- The user is about to commit changes to the game and the diff touches `src/`, `index.html`, `package.json`, or `vite.config.js`.
- The user explicitly says `/update-readme`, "update the readme", "refresh the docs", or similar.
- You just modified the game (added a feature, changed a control, tweaked a major tunable) — proactively suggest running this skill before recommending a commit.

Do NOT use this skill for:
- Pure internal refactors that don't change behavior.
- Cosmetic-only config changes (e.g., colors).
- Changes to `plan-game.md` (it's the design doc; README is the player-facing summary).

---

## Sources of truth

Read these files to derive the README content. The code is canonical; the README mirrors it.

| File | What to extract |
|---|---|
| `src/config.js` (`CFG`) | All tunable numbers: arena size, player (HP, speeds, fire rate, dash), bullet, enemy, dasher, waves, combo, bonus levels, shieldBonus. |
| `src/scenes/GameScene.js` | Feature surface: movement, aim, fire, dash, wave system, enemy types, bonus pickups, shield pickup, combo, pause, HUD. Input wiring (`addKeys`, pointer handlers) drives the Controls section. |
| `src/scenes/GameOverScene.js` | Restart key. |
| `package.json` | Project name, version, scripts (`dev`/`build`/`preview`), Phaser + Vite versions. |
| `index.html` | Mount point and any in-page styles worth surfacing. |

---

## Sections README.md must keep in sync with code

Maintain these sections in this order. If a section doesn't yet exist in `README.md`, create it. If a section exists but the code no longer supports its content, remove it.

### 1. Title + tagline
Short. One sentence. Mention the genre and the inspiration (Onslaught! Arena).

### 2. Features
Bulleted list of what a player can actually do right now. Each bullet must map to real code — verify before listing. Example sources:
- "WASD movement + mouse aim" ← `handleMovementAndDash`, `updateAim`
- "Dash with brief invulnerability" ← `tryDash` + `player.invulnerableUntil`
- "Combo multiplier" ← `comboMultiplier`, `maybeDecayCombo`
- "Pause" ← `togglePause`

### 3. Tech stack
- Engine: Phaser (look up actual version in `package.json` deps)
- Build: Vite (version from devDeps)
- Language: JavaScript ESM
- Physics: Phaser Arcade Physics
- Rendering: primitive shapes (`Arc`, `Rectangle`, `Polygon`), no asset pipeline

### 4. Run / Build
Mirror `package.json` scripts exactly. Use the actual script names.

### 5. Controls
Table. One row per bound key/action. Derive from input wiring in `GameScene.create()` (`addKeys`, `createCursorKeys`, pointer events) and `GameOverScene.create()`.

### 6. Enemies
For each enemy `type` in `GameScene`:
- Name (swarmer, dasher, ...)
- Visual (color, shape)
- Behavior (one sentence)
- HP (`CFG.enemy.hp` / `CFG.dasher.hp`)
- Appears from wave N (`CFG.dasher.appearFromWave` and similar)
- Spawn ratio if mixed (`CFG.dasher.spawnRatio`)

### 7. Power-ups
- **Green bonus ladder**: enumerate `CFG.bonus.levels` (skip level 0). For each, list fire rate, bullet pattern (`angles`), and label. Mention the hit-cascade rule (step down one level + lose HP).
- **Gold-star shield**: max hits (`CFG.shieldBonus.maxHits`), duration (`CFG.shieldBonus.durationMs`), pickup lifetime on arena (`CFG.shieldBonus.lifetimeMs`).
- For both: spawn cadence range (`spawnDelayMinMs`–`spawnDelayMaxMs`), despawn-on-arena lifetime.

### 8. Tunables snapshot
A small table of the gameplay-defining numbers. Pull values directly from `CFG`. Include at least: player HP, player base fire rate, swarmer base speed + per-wave growth, wave base count + growth, combo reset window, combo max multiplier. Don't list colors or pure visual constants.

### 9. Roadmap
One sentence + link to `plan-game.md`. Do not duplicate the plan. Optionally note "Phase 1 features above; later phases in plan-game.md".

---

## Execution steps

1. **Read all source files** listed under "Sources of truth". Don't guess values — read them.
2. **Read the current `README.md`**.
3. **Diff mentally**: for each maintained section, compute the desired content and compare to what's there.
4. **Apply minimum edits**:
   - Prefer `Edit` tool for targeted replacements.
   - Use `Write` only if the section structure itself needs restructuring (rare).
5. **Verify** the result still renders cleanly as Markdown — no broken tables, no orphan headings, no stale references to removed features.
6. **Report**: print a concise summary of what changed (e.g., "Updated dasher.appearFromWave from 20 → 5 in Enemies table; added shield-pickup row to Power-ups."). If nothing changed, say so explicitly: "README already matches the code; no changes."

---

## Style rules for the README

- Tight bullets. No marketing language.
- No emoji unless the user explicitly added them.
- No personal commentary, TODO lists, or change history (that's git's job, or the plan's).
- No exposed internals: don't reference class names, method names, or file paths beyond the run instructions.
- Tables for: Controls, Enemies, Power-up ladder, Tunables snapshot.
- Code fences only for shell commands (`npm run dev`, etc.).
- Keep the whole README under ~150 lines.

---

## After updating

Do not stage, commit, or push. Just leave the updated `README.md` in the working tree and tell the user what changed. They can decide when to commit.
