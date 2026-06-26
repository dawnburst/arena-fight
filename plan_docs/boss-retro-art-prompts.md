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
