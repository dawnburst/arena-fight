# Arena Fight — Store & Roguelite Meta-Progression Plan

> A persistent shop layer for Arena Fight. Coins drop during runs, runs end on death, the store opens, the player buys weapons and mods, then equips a loadout for the next run. Coins and inventory persist forever via `localStorage`.

This is a self-contained extension on top of the Phase 1 game. See `plan-game.md` for the underlying game design.

---

## Table of contents

1. [Context](#1-context)
2. [The loop](#2-the-loop)
3. [Currency: coins](#3-currency-coins)
4. [Persistence](#4-persistence)
5. [Flow: Game Over → Store → Loadout → Run](#5-flow-game-over--store--loadout--run)
6. [Weapon catalog](#6-weapon-catalog)
7. [Mod catalog](#7-mod-catalog)
8. [Pricing tiers](#8-pricing-tiers)
9. [UI screens](#9-ui-screens)
10. [Code integration](#10-code-integration)
11. [Verification](#11-verification)
12. [Open questions / future](#12-open-questions--future)

---

## 1. Context

The Phase 1 prototype is a single-run survival game: you die, you press R, fresh slate. Adding a roguelite layer gives players a long-term goal beyond "beat my last wave count" — they're saving up for unlocks, building loadouts, experimenting with combinations. It turns a 5-minute arcade game into something you come back to across multiple sessions.

**Decisions already locked in** (from clarifying questions):

| Decision | Choice |
|---|---|
| Store access | Only on Game Over (meta loop) |
| What's sold | Weapons + Mods |
| Equip model | Loadout: 1 weapon + **2 mods** at run start |
| Coin sources | Per-kill drops + per-wave-clear bonus |
| Coin pickup | Drops on arena, magnets to player within ~150px |
| Persistence | Coins AND items both persist across runs (`localStorage`) |
| Item tiers | 5: Common / Uncommon / Rare / Epic / Legendary |
| Difficulty scaling | None — fixed wave curve, player power gates deeper waves |

**Assumed defaults** (easy to override before implementation):
- **Starter Pistol owned for free** on first launch (no empty-weapon edge case).
- **Mod slots fixed at 2** for Phase 1. Could become 3 at the high end later.
- **One copy per item.** Duplicates are not a thing — owning an item is binary.

---

## 2. The loop

```
   ┌─────────┐    die     ┌──────────────┐  buy   ┌──────────────┐  pick   ┌──────┐
   │  RUN    │ ─────────▶ │  GAME OVER   │ ─────▶ │    STORE     │ ──────▶ │ LOAD │
   │ (Game   │            │ (summary +   │        │ (browse +    │         │ OUT  │
   │  Scene) │            │  coin total) │ ◀──── │  purchase)   │         └───┬──┘
   └────▲────┘            └──────┬───────┘  back  └──────────────┘             │
        │                        │                                              │
        │                  ┌─────▼─────┐                                        │
        └────────────────  │ skip shop │ ◀──────────────────────────────────────┘
                   start   └───────────┘   start
```

After every run, the player sees their stats and a summary of coins earned. They can browse the store, then go to the loadout screen to choose their weapon + 2 mods for the next attempt, then start a fresh run.

The store is **always optional**. The player can skip it and just retry with their current loadout.

---

## 3. Currency: coins

### 3.1 Sources

**Per enemy kill (in-arena drop):**

Each enemy killed drops `1 + (comboMultiplier - 1)` coins at its position. So:
- x1 combo → 1 coin per kill
- x4 combo → 4 coins per kill
- x8 combo (cap) → 8 coins per kill

Rationale: ties the coin economy to the combo loop the player already cares about. High-skill play earns more.

**Per wave clear (lump payout):**

When a wave's enemies are all dead, payout = `25 + 10 × waveNumber`.

| Wave | Bonus |
|---|---|
| 1 | 35 |
| 5 | 75 |
| 10 | 125 |
| 20 | 225 |
| 30 | 325 |

Shows as a floating "+125" text near the player when the wave ends.

### 3.2 Run yield (estimate)

A typical 10-wave run with ~5 swarmers/wave, average x3 combo: ~50 kills × 3 = 150 coins from kills, plus wave-clear payouts totaling ~800 (sum of 35 + 45 + ... + 125). That's ~950 coins per 10-wave run.

A bad early run (2 waves, low combo) yields ~50 coins.
A skilled long run (25 waves) might net ~3000+ coins.

### 3.3 On-arena coin behavior

- **Visual**: small yellow circle (4px radius), distinct from bullets (also yellow but smaller and they move). Slight idle pulse animation.
- **Spawn**: at the killed enemy's position, with a small random velocity (~30 px/s in a random direction) so coins scatter slightly.
- **Magnet**: when player is within `coinMagnetRadius` (150px), coin accelerates toward player at ~400 px/s.
- **Pickup**: overlap with player → add to coin counter, destroy coin, brief floating "+N" text.
- **Despawn**: no time limit (coins stay until collected) for Phase 1. Avoids frustration of missing coins in chaos.

### 3.4 In-run HUD

Add a coin counter to the HUD: top-center, format `¢ 187`. Increments live as coins are collected.

The HUD shows the **current run's coins** (not the persistent wallet). On death, those coins are added to the persistent wallet on the Game Over screen.

---

## 4. Persistence

### 4.1 Storage

Single `localStorage` key: `arenaFight.save.v1`. JSON value with this schema:

```json
{
  "version": 1,
  "wallet": 587,
  "ownedWeapons": ["pistol", "burst", "spread"],
  "ownedMods": ["quick-draw", "steel-plate"],
  "loadout": {
    "weapon": "spread",
    "mods": ["quick-draw", "steel-plate"]
  },
  "stats": {
    "runsPlayed": 12,
    "bestWave": 18,
    "bestScore": 8400,
    "totalCoinsEarned": 4321
  }
}
```

**Why `v1`**: future-proofs the schema. If we ever add new fields or change names, we bump to `v2` and write a migrator (or wipe + warn).

**Defaults on first launch** (no save key present):

```json
{
  "version": 1,
  "wallet": 0,
  "ownedWeapons": ["pistol"],
  "ownedMods": [],
  "loadout": { "weapon": "pistol", "mods": [null, null] },
  "stats": { "runsPlayed": 0, "bestWave": 0, "bestScore": 0, "totalCoinsEarned": 0 }
}
```

### 4.2 Read / write points

- **Read**: once on page load (a new module `src/save.js` does this).
- **Write**: after every meaningful change:
  - On Game Over: persist coins earned into wallet + update stats.
  - On purchase: wallet decreases, `ownedX` array gains entry.
  - On loadout change: persist `loadout`.
- **Atomicity**: all writes go through `Save.set()` which JSON-stringifies the whole object and writes the single key. No partial writes possible.

### 4.3 Reset

A small "Reset save" button on the Store screen with a confirmation prompt. Useful during development and respects the player's right to start over.

---

## 5. Flow: Game Over → Store → Loadout → Run

### 5.1 Game Over screen (extended)

Currently shows: `GAME OVER`, wave reached, score, "press R to restart".

New layout:

```
                        GAME OVER

                  Wave reached: 12
                  Score:       4,200
                  Coins earned: +287   (wallet: 587 → 874)

                  [ STORE ]   [ LOADOUT ]   [ RETRY ]
                       S            L            R
```

- `S` opens StoreScene
- `L` opens LoadoutScene
- `R` (or click "RETRY") goes straight to a fresh GameScene with the current loadout

If the wallet didn't change (a 0-coin run), the "Coins earned" line shows `+0`.

### 5.2 Store scene

Player browses weapons and mods, filtered by tier. Purchasing deducts coins, adds the item to `ownedWeapons` or `ownedMods`. Already-owned items show OWNED instead of a buy button.

Layout in §9.2.

### 5.3 Loadout scene

Player selects 1 weapon (from `ownedWeapons`) and up to 2 mods (from `ownedMods`). Mod slots can be left empty. Saves to `loadout`. Then "Start Run" → GameScene.

Layout in §9.3.

### 5.4 GameScene init

GameScene reads the current `loadout` from save on `create()` and configures:
- The player's base fire rate, bullet pattern, bullet behavior from the equipped weapon's definition.
- All equipped mods' passive effects (applied to player stats, coin drop rates, magnet range, etc.).

---

## 6. Weapon catalog

Weapons replace the player's base fire behavior. Only one weapon equipped at a time.

| ID | Name | Tier | Fire | Pattern | Special | Price |
|---|---|---|---|---|---|---|
| `pistol` | Pistol | Common | 500ms | 1 forward | (default, free) | 0 |
| `burst` | Burst | Common | 100ms × 3 then 600ms cooldown | 1 forward | Salvo: 3 shots fast then pause | 110 |
| `shotgun` | Shotgun | Uncommon | 800ms | 5 bullets ±40° cone | Short range (lifetime 350ms) | 280 |
| `spread` | Spread | Uncommon | 400ms | 3 bullets at ±25° and 0° | — | 340 |
| `rapid` | Rapid | Rare | 130ms | 1 forward | Always fast, no power-ups needed | 650 |
| `sniper` | Sniper | Rare | 1200ms | 1 forward | Bullet pierces all enemies | 780 |
| `boomerang` | Boomerang | Epic | 700ms | 1 forward | Returns after 500ms, hits on the way back | 1,400 |
| `beam` | Beam | Epic | continuous | hitscan line while held | Heats up: 1.5s max then 1s cooldown | 1,700 |
| `plasma` | Plasma Cannon | Legendary | 1500ms | 1 forward | Explodes on hit (AOE 60px) | 3,400 |
| `twin-pulse` | Twin Pulse | Legendary | 250ms | 2 bullets | Second bullet curves toward nearest enemy | 4,200 |

**Power-up interaction:** the green-bonus ladder still applies on top of weapons. At Lvl3, all weapons fire 3 bullets at ±30° (their base pattern is replaced by tri-spread). Future tuning may differentiate — e.g., shotgun + Lvl3 = 7-bullet wider cone.

---

## 7. Mod catalog

Mods are passive effects. The player equips up to 2 from `ownedMods`.

| ID | Name | Tier | Effect | Price |
|---|---|---|---|---|
| `quick-draw` | Quick Draw | Common | -10% fire rate | 80 |
| `pocket-wallet` | Pocket Wallet | Common | +20% coin drops | 120 |
| `stride` | Stride | Common | +10% move speed | 100 |
| `steel-plate` | Steel Plate | Uncommon | +1 max HP | 260 |
| `magnet-boots` | Magnet Boots | Uncommon | coin magnet radius +50% | 230 |
| `combo-glove` | Combo Glove | Rare | combo decay window +1s | 540 |
| `extra-dash` | Extra Dash | Rare | dash cooldown -50% | 700 |
| `eagle-eye` | Eagle Eye | Epic | bullet speed +25%, bullets +25% lifetime | 1,200 |
| `glass-cannon` | Glass Cannon | Epic | -1 max HP, +40% fire rate | 1,500 |
| `lucky-charm` | Lucky Charm | Legendary | 10% chance for double coin drops | 2,800 |
| `phoenix` | Phoenix | Legendary | Revive once per run with 1 HP and full shield | 3,800 |

**Mod stacking rules:**
- Mods that modify the same stat (e.g., two "+fire rate" mods) stack multiplicatively.
- Mods do not appear twice in inventory (one of each).
- `glass-cannon` + `steel-plate` is allowed; they algebraically cancel partially.

---

## 8. Pricing tiers

| Tier | Price range | Item count | Runs to afford (avg) |
|---|---|---|---|
| Common | 50–150 | 3 weapons, 3 mods | ~1 short run |
| Uncommon | 200–400 | 1 weapon, 2 mods | ~1 medium run |
| Rare | 500–900 | 1 weapon, 2 mods | ~2 runs |
| Epic | 1,200–2,000 | 1 weapon, 2 mods | ~3–4 runs |
| Legendary | 2,800–4,500 | 2 weapons, 2 mods | ~6–10 runs |

This curve targets the satisfying roguelite pacing of *Hades*-style games: cheap initial purchases let players experiment immediately, then a few medium-grind goals, then a multi-session legendary chase.

---

## 9. UI screens

ASCII mockups so you can see the shape. Real implementation in Phaser text + rectangles.

### 9.1 Game Over (expanded)

```
+──────────────────────────────────────────────+
│                                              │
│                  GAME OVER                   │
│                                              │
│              Wave reached: 12                │
│              Score:       4,200              │
│           Coins earned: +287                 │
│           Wallet:  587 → 874                 │
│                                              │
│       [ STORE ]   [ LOADOUT ]   [ RETRY ]     │
│            S            L            R       │
│                                              │
+──────────────────────────────────────────────+
```

Buttons are clickable AND keyboard-shortcut: S, L, R.

### 9.2 Store scene

```
+──────────────────────────────────────────────+
│  STORE                       ¢ 874           │
│  [WEAPONS]  [MODS]                           │
│  ─────────────────────────────────────────   │
│  COMMON                                      │
│   • Burst             ¢ 110   [BUY]          │
│   • Quick Draw         ¢  80  [OWNED]        │
│   • Pocket Wallet     ¢ 120   [BUY]          │
│  UNCOMMON                                    │
│   • Shotgun           ¢ 280   [BUY]          │
│   ...                                        │
│                                              │
│  [ Back ]                  [ Reset save ]    │
+──────────────────────────────────────────────+
```

- Tabs at top switch between Weapons and Mods catalog.
- Items show name, price, and a button (BUY / OWNED / NOT ENOUGH ¢).
- Hovering an item shows its full description in a side panel (or below).
- "Reset save" with confirm dialog.

### 9.3 Loadout scene

```
+──────────────────────────────────────────────+
│  LOADOUT                                     │
│                                              │
│   Weapon:  < Spread >                        │
│            400ms · 3 bullets at ±25° / 0°    │
│                                              │
│   Mod 1:   < Quick Draw >                    │
│            -10% fire rate                    │
│                                              │
│   Mod 2:   < (empty) >                       │
│                                              │
│   [ Start Run ]      [ Back ]                │
+──────────────────────────────────────────────+
```

- Arrows cycle through owned items in each slot.
- "(empty)" is valid for mod slots; weapon slot always has a value.
- "Start Run" persists loadout to save then transitions to GameScene.

---

## 10. Code integration

New files:

```
src/
├── save.js                # localStorage read/write + defaults + migration
├── catalog.js             # WEAPONS + MODS catalogs (all stats/prices/effects)
├── scenes/
│   ├── StoreScene.js      # browse + purchase
│   ├── LoadoutScene.js    # equip weapon + mods, persist
│   └── GameScene.js       # MODIFIED: read loadout, drop coins, magnet
└── effects/
    ├── weapons.js         # implementations of each weapon's fire behavior
    └── mods.js            # implementations of each mod's effect application
```

Modified files:

- `src/main.js`: register `StoreScene` and `LoadoutScene`.
- `src/config.js`: add `coin` section (radius, color, magnet, drop speeds, despawn).
- `src/scenes/GameScene.js`:
  - On `create()`: read `Save.get().loadout`; apply weapon + mods to player config.
  - On enemy kill (`onBulletHitEnemy`): spawn coin(s) at enemy position.
  - Per-frame: magnet coins toward player; on overlap → collect.
  - On wave clear: schedule wave-bonus coin payout (floating "+125" text + add to in-run total).
  - On `endGame()`: pass `coinsThisRun` to GameOverScene.
- `src/scenes/GameOverScene.js`: extend to show coin summary; bind S/L/R keys; on launch, `Save.addToWallet(coinsThisRun)` + update stats.

### 10.1 Weapon implementation contract

Each weapon in `catalog.js` has:

```js
{
  id: 'spread',
  name: 'Spread',
  tier: 'uncommon',
  price: 340,
  description: '3 bullets at ±25° and 0°',
  fire: {
    rateMs: 400,
    angles: [-25, 0, 25],     // bullets per shot
    bulletMods: {},           // optional: piercing, returning, exploding, etc.
  }
}
```

`fire.angles` is interpreted by the existing `handleFire` logic (which already iterates angles for the green-bonus ladder). For weapons that need exotic behavior (boomerang, beam, plasma AOE), `bulletMods` carries flags consumed by `fireBullet` and bullet-update code.

### 10.2 Mod implementation contract

Each mod has:

```js
{
  id: 'quick-draw',
  name: 'Quick Draw',
  tier: 'common',
  price: 80,
  description: '-10% fire rate',
  apply: (ctx) => { ctx.fireRateMult *= 0.9; }
}
```

Mods receive a `ctx` (player stat bundle) at run start and mutate it. Stats like `fireRateMult`, `coinDropMult`, `magnetRangeMult`, `moveSpeedMult`, `maxHpDelta`, etc. are applied additively/multiplicatively to base CFG values when the run begins.

### 10.3 New CFG section

```js
coin: {
  radius: 4,
  color: 0xffd54f,
  dropSpeed: 30,         // initial scatter speed
  magnetRadius: 150,
  magnetAccel: 800,      // px/s² toward player when within radius
  maxSpeed: 600,
}
```

---

## 11. Verification

End-to-end checks after implementation.

### 11.1 First launch

- No save key present → defaults applied. Player has Pistol equipped, 0 coins.
- Game plays exactly as Phase 1 baseline.

### 11.2 Coin economy

- Kill an enemy → see yellow coin spawn at its position.
- Walk within 150px → coin flies toward player.
- Overlap → coin disappears, HUD counter goes up by `1 × combo`.
- Clear a wave → floating "+N" text appears, HUD counter jumps.
- Die → Game Over shows correct `Coins earned` matching HUD.

### 11.3 Purchase

- Open Store from Game Over. Wallet shows correct total.
- Buy a Common item costing ≤ wallet. Wallet decreases. Item shows OWNED.
- Try to buy an item costing > wallet. Button shows NOT ENOUGH ¢, click does nothing.
- Refresh the page. Save persisted: wallet + owned items intact.

### 11.4 Loadout

- Loadout screen lists only owned weapons + mods.
- Cycling through options updates the displayed name + description.
- Selecting "(empty)" mod slot is valid.
- Start Run → next run uses the new weapon + mods. Verify: a Spread weapon shoots 3 bullets; a Quick Draw mod measurably reduces fire rate.

### 11.5 Persistence edge cases

- Reset save → wallet returns to 0, only `pistol` owned, loadout reset.
- Corrupt save (manually edit localStorage to invalid JSON) → `Save.get()` falls back to defaults without crashing.
- Schema mismatch (`version` differs) → log a warning and use defaults (Phase 1: no migrator needed).

### 11.6 Non-functional

- 60 FPS stable when 20+ coins are on screen with magnet active.
- No errors in browser console during a full run + purchase cycle.

---

## 12. Open questions / future

These don't block Phase 1 of the store, but they're decisions to make later:

- **Item descriptions in-store**: do they get a dedicated info panel, or just inline? (Mockup shows inline; could expand to panel later.)
- **Sound feedback**: coin pickup chime, purchase confirmation, error buzz. Deferred until audio Phase 5.
- **Duplicate item handling**: currently binary owned/not. Could later allow stacking (e.g., own 2 Quick Draws for -20%). Adds complexity.
- **Refunds**: not supported. Could add a "sell at 50%" option later.
- **Daily run / seeded run**: doesn't interact with store but could become a meta feature.
- **Catalog rotation / new items per run**: currently static catalog. Could add weekly-rotating featured items.
- **Cosmetics**: not in scope. Could add later for pure spending without affecting balance.
- **Cloud save**: Phase 1 is `localStorage` only — browser-local. Multi-device sync requires a backend.

### Out of scope (deferred)

- Audio for any store / coin event
- Animations beyond the existing tween polish
- Tutorial / onboarding for first-time players
- Achievements
- Leaderboards
- Multi-character / class system

---

*End of store plan.*
