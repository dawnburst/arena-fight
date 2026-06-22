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
