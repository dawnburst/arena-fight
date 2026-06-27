# Boss Retro-Art Progress

## Wave 30 — The Hexweaver · id `hexweaver`

**Implementation status (2026-06-21): complete.** All 23 frames were generated,
normalized to transparent 256×256 RGBA PNGs, and integrated from
`public/assets/enemies/boss/hexweaver/`.

Colours: body `#0d47a1`, accent `#42a5f5`, core `#80d8ff`, projectile
`#64b5f6`. Phase powers are `beamSweep`, `mirrorClones`, and `gravityWell`;
weak-point counts are 2 / 3 / 3.

Integrated states:

- Eight directional hover-idle poses: S, N, W, E, SE, SW, NE, NW.
- Four south-facing hover-cycle frames.
- Telegraph and release frames for each of the three phase powers.
- One phase-3 enrage frame.
- Four one-shot death frames.
- Eight directional Rune Prowler frames replace phase-2 primitive circle decoys.

The shield dome and orbiting weak points remain code-drawn overlays. Gameplay
locks telegraph/release frames until the real power fires, cancels delayed casts
during cleanup, and falls back to primitive rendering for bosses without art.

## Wave 40 — The Bombardier · id `bombardier`

**Implementation status (2026-06-22): complete.** All 23 frames were generated,
normalized to transparent 256×256 RGBA PNGs, and integrated from
`public/assets/enemies/boss/bombardier/`.

Colours: body `#bf360c`, accent `#ff8a65`, core `#ffd54f`, projectile
`#ff7043`. Phase powers are `aimedVolley`, `barrage`, and `charge`; weak-point
counts are 2 / 2 / 3.

Integrated states:

- Eight directional idle poses: S, N, W, E, SE, SW, NE, NW.
- Four south-facing walk-cycle frames.
- Telegraph and release frames for each of the three phase powers.
- One phase-3 enrage frame.
- Four one-shot death frames.

The shield dome and orbiting weak points remain code-drawn overlays. Gameplay
locks attack art through the real release, preserves world-space collision size,
and uses the south-facing portrait in the Monsters gallery.

## Wave 50 — The Phantom · id `phantom`

**Implementation status (2026-06-25): complete.** All 25 frames were generated,
normalized to transparent 256×256 RGBA PNGs, and integrated from
`public/assets/enemies/boss/phantom/`.

Colours: body `#004d40`, accent `#4db6ac`, core `#b2ff59`, projectile
`#1de9b6`. Phase powers are `barrage`, `nova`, `charge`, and `dotField`;
weak-point counts are 3 / 3 / 3.

Integrated states:

- Eight directional idle poses: S, N, W, E, SE, SW, NE, NW.
- Four south-facing hover/walk-cycle frames.
- Telegraph and release frames for each of the four phase powers.
- One phase-3 enrage frame.
- Four one-shot death frames.

The shield dome and orbiting weak points remain code-drawn overlays. Gameplay
uses the shared boss-art telegraph/release locks for barrage, nova, and dot-field
casts, the existing charge windup/release lock for lunges, and the south-facing
portrait in the Monsters gallery.

## Wave 60 — The Overlord · id `overlord`

**Implementation status (2026-06-26): complete.** All 25 frames were generated,
normalized to transparent 256×256 RGBA PNGs, and integrated from
`public/assets/enemies/boss/overlord/`.

Colours: body `#b71c1c`, accent `#ef5350`, core `#ffca28`, projectile
`#ff5252`. Phase powers are `missiles`, `barrage`, `charge`, and `nova`;
weak-point counts are 2 / 3 / 3.

Integrated states:

- Eight directional idle poses: S, N, W, E, SE, SW, NE, NW.
- Four south-facing walk-cycle frames.
- Telegraph and release frames for each of the four phase powers.
- One phase-3 enrage frame.
- Four one-shot death frames.

The shield dome and orbiting weak points remain code-drawn overlays. Gameplay
locks missile, barrage, and nova attack art through the real release, uses the
charge telegraph/release frames across the existing windup and lunge states,
preserves world-space collision size, and uses the south-facing portrait in the
Monsters gallery.

## Boss-Wave Background — Hell Arena · `hell-arena.png`

**Implementation status (2026-06-27): complete.** Saved as
`public/assets/backgrounds/hell-arena.png`, resized to **800×600** to match the
three selectable arena backgrounds. Loaded in `GameScene.preload()` and
cross-faded in/out on boss waves via `enterBossBackground()` /
`exitBossBackground()` (see `CODEBASE.md`). Exported as `BOSS_BACKGROUND` in
`src/backgrounds.js`, kept out of the player-selectable list.

### Image-to-image generation prompt (Gemini / image generator)

**Source image to upload:** `public/assets/backgrounds/moss-ruins.png` — the
darkest of the three current arena options, so its stone/ruin layout converts
most naturally into a scorched hell arena while keeping the familiar composition.
The intent is a **transform**, not a from-scratch image.

> Transform this top-down arena floor texture into a "hell arena" version while
> keeping the exact same overhead camera angle, layout, composition, and the
> position of the stone tiles, cracked patches, and paths from the original
> image. Reskin the materials: turn the moss and grass into scorched black
> obsidian and charred volcanic rock, turn the cracks between the stones into
> glowing molten lava veins (bright orange-red, emissive), and replace the old
> tiles with cracked basalt slabs. Add faint drifting embers and a low red/orange
> ambient glow rising from the lava cracks, with darker scorched edges toward the
> corners (subtle vignette). Keep it a seamless, evenly-lit playfield: no
> characters, no props, no text, no UI, no large bright hotspots that would
> distract from gameplay sprites on top. Dark, ominous, high-contrast, retro
> game art style consistent with a top-down arena shooter. Output a flat
> top-down ground texture filling the whole frame.

Tuning notes: request 4:3 (~800×600 or larger); keep the floor dark and even so
gameplay sprites/bullets stay readable; lower transformation strength if the
layout drifts. Convert the output to an exact 800×600 PNG before saving, e.g.
`magick generated.png -resize 800x600! public/assets/backgrounds/hell-arena.png`
(use `-resize 800x600^ -gravity center -extent 800x600` for non-4:3 sources).
