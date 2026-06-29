# Arena Fight

[![Build & Verification](https://github.com/dawnburst/arena-fight/actions/workflows/pr-build.yml/badge.svg)](https://github.com/dawnburst/arena-fight/actions/workflows/pr-build.yml)
[![Live Deployment](https://github.com/dawnburst/arena-fight/actions/workflows/deploy.yml/badge.svg)](https://github.com/dawnburst/arena-fight/actions/workflows/deploy.yml)
[![Current Version](https://img.shields.io/github/v/release/dawnburst/arena-fight)](https://github.com/dawnburst/arena-fight/releases)

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

Production builds use the `/arena-fight/` base path for GitHub Pages. Deployments and official releases are triggered manually through the **"Deploy static content to Pages"** workflow in GitHub Actions. Ensure repository Pages are configured to use `GitHub Actions` as the source.

## Run with Docker

The included [`Dockerfile`](./Dockerfile) builds the static bundle (served from the root path, not the GitHub Pages `/arena-fight/` base) and serves it with nginx.

```bash
# Build the image
docker build -t arena-fight .

# Run it, mapping the container's port 80 to localhost:8080
docker run --rm -p 8080:80 arena-fight
```

Then open `http://localhost:8080/` in any modern browser. Stop the container with `Ctrl+C`.

To serve on a different host port, change the left side of the `-p` mapping (e.g. `-p 3000:80` → `http://localhost:3000/`).

## Controls

| Action | Key |
|---|---|
| Move | `W` `A` `S` `D` (or arrow keys) |
| Aim | Mouse (sniper-target cursor in the arena) |
| Fire (hold) | Left mouse button |
| Dash | `Space` |
| Swap weapon | `C` (when a second weapon is equipped) |
| Pause / Resume | `P` or `Esc` |
| Fullscreen | `F` |
| Menu navigation | Mouse or arrow keys + `Enter` |

Pausing opens an in-game menu — **Resume**, **Restart Run**, **Settings** (toggle
music and sound without dying), and **Quit to Menu** — navigable by keyboard,
mouse, or touch.

On phones and tablets the game switches to on-screen **twin-stick** controls: the
left stick moves, the right stick aims and fires automatically, and there are
on-screen dash, pause, and weapon-switch buttons. The controls hug the screen
corners. A top-left **MENU** button opens the pause menu (Resume, Restart Run,
Settings, Quit to Menu — all tappable), and
every menu screen (Store, Loadout, Settings, Monsters, Achievements) gets on-screen **BACK** and
navigation buttons so the whole game is playable without a keyboard. Play in
**landscape** — held in portrait, the game pauses and asks you to rotate. Touch
mode is detected automatically and can be forced on or off in Settings.

The game is **responsive on mobile**: it keeps a fixed world height (600) and
widens the arena to match your device's landscape aspect, so the play field fills
the screen edge-to-edge with no black bars. **Fullscreen** is on by default and
auto-enters on your first tap; press `F` (or the Settings row) to toggle it.
Desktop windowed play stays exactly 800×600 and unchanged.

## Tutorial

New players get an **interactive, step-by-step tutorial** — there are no hints
during a normal run.

- Each step shows a short explanation and pauses the game; press
  `SPACE` / `ENTER` (or tap/click) to continue, then **do** what it asks before
  the next step appears.
- It walks through the core moves in order: move, aim & fire, dash, combo, coins,
  the green gift, the gold shield, and how bosses work.
- You **can't die** in the tutorial, and it doesn't count toward your stats.
- Each completed step gives a little praise ("Good job!", "Great!") before moving
  on.
- Start it any time from the main menu's **TUTORIAL** button (shortcut `T`).
  Press `Esc` to leave.

## Settings

The Settings menu lets you choose the arena background and control the looping background music. Boss waves cross-fade to a dedicated, more intense boss track and resolve back to the normal track when the boss is defeated (respecting the music on/off and volume settings):

- Music on/off toggle.
- Volume slider.
- Sound effects on/off toggle.
- Sound effects volume slider.
- Touch controls mode: Auto / On / Off (applies on reload).
- Fullscreen On / Off (persisted; applies immediately).
- Keyboard shortcuts: `M` toggles music, `S` toggles sound, `T` cycles touch controls, `F` toggles fullscreen, `+` / `-` adjusts volume.
- Gameplay sound effects play for shots, coins, dash and dash-ready, gifts/mods, shield pickups and blocks, enemy hits and deaths, boss spawn/hit/phase/defeat, player hits, combo up/break, wave start/clear, game start, and game over.
- UI sound effects play for menu navigation, confirm/cancel, and store purchase success/failure.

## Goal

Survive escalating waves of monsters. Each kill builds your score, coins persist in your wallet, and store upgrades help future runs.

## Store, loadout & skins

Spend your coins in the **Store**, which has three tabs:

- **Weapons** and **Equipment** — grouped by tier, bought with coins.
- **Skins** — cosmetic character looks, listed cheapest → most expensive. Buying
  a skin equips it automatically; tap an owned skin to re-equip it. The default
  **Recruit** look is free and always yours.

In the **Loadout** screen you pick up to two weapons, up to two pieces of
equipment, and your **skin** for the next run. Owned items and your equipped skin
persist between runs.

In the arena, the weapon held by your character now matches the active weapon.
Swapping weapons changes the visible held sprite immediately; any weapon missing
dedicated held art falls back to the original rifle overlay.

## Achievements

Open the **ACHIEVEMENTS** screen from the main menu (shortcut `A`) to browse a
tiered badge gallery, grouped by category (Combat / Progression /
Mastery / Collection):

- **Tiered achievements** (Wave Climber, Slayer, Treasure Hoarder, Boss Hunter,
  Combo Adept) each have **Bronze → Silver → Gold → Diamond** tiers with rising
  targets and points. Tap/click a badge for a detail popup with a `current/target`
  progress bar.
- **One-off achievements** (First Blood, Sharpshooter, Untouchable, Arsenal)
  unlock in a single step.
- Badges show in **full colour once unlocked** and **greyed-out while locked**.
- The main menu shows a **Best** showcase — your best wave, best score, bosses
  defeated, rarest badge, and achievement level — and when a run ends, every new
  badge **pops in and turns from grey to colour** with its points.

Total points feed a simple level curve (every `CFG.achievements.pointsPerLevel`
points = one level). Progress and unlocks persist in your save.

## Bosses

Every 10th wave is a boss fight. Each boss wave brings a different giant
shielded boss with its own colours and moves — from **The Warden** at wave 10 up
to the final boss, **The Annihilator**, at wave 100 — and they get tougher the
deeper you go. A boss summons its own minions instead of a normal wave, and can
only summon monster types that have already appeared in earlier waves. The arena
also transforms for the fight: the field cross-fades to a scorched **Hell Arena**
background and your standard bullets glow a bright color so they stay readable
over the dark floor, both reverting once the boss falls.

Each boss you beat becomes a permanent **checkpoint**. After clearing a boss
wave you can **CONTINUE** from the wave right after it on a later run instead of
restarting from wave 1 — beat the wave-10 boss to unlock a wave-11 start, the
wave-20 boss to advance to wave 21, and so on (up to the final boss at wave 100).
The checkpoint survives death and persists across sessions, and your wallet,
weapons, and loadout carry over as usual. The main menu shows **CONTINUE** (resume
from your checkpoint) alongside **NEW GAME** (a fresh wave-1 run, which keeps your
checkpoint), and the game-over screen reminds you where you'll continue from.

Every boss shares the same core rules: an energy shield blocks body hits and
regenerates each phase, while small weak points orbiting its body always take
damage (and take extra) — so you can snipe the weak points to bypass the shield,
or break the shield then unload. Across three escalating phases a boss draws from
a pool of attacks (radial barrages, spiraling fire, aimed volleys, charges and
ground-slams, area-denial blasts, shield re-raises), with different bosses
favouring different moves. Beating one pays a large coin bonus that scales with
the boss number. The Warden, wave-20 Juggernaut, wave-30 Hexweaver, wave-40
Bombardier, wave-50 Phantom, wave-60 Overlord, wave-70 Tempest, wave-80
Colossus, wave-90 Voidcaller, and the wave-100 final boss Annihilator use
complete retro pixel-art animation sets for movement, attacks, their enraged
final phases, and defeat; other bosses currently retain the colour-coded
fallback body.

The wave-30 Hexweaver uses a complete retro sprite set in gameplay and the
Monsters gallery: directional hover poses, spell telegraphs/releases, phase-3
enrage, and a four-frame death sequence. Its shield and weak points remain
separate animated gameplay overlays. In phase 2 it summons directional Rune
Prowler creatures that move at range and fire cyan bolts instead of primitive
circle decoys.

<img width="813" height="600" alt="image" src="https://github.com/user-attachments/assets/33332e4e-fafd-4932-b616-7071bdfd1b82" />

<img width="813" height="600" alt="image" src="https://github.com/user-attachments/assets/1073c2c0-190e-4b4c-a852-dd33de8c9835" />
