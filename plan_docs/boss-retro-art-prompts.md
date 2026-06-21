# Boss Retro-Art Prompts

> Image-generation prompts for the Arena Fight bosses, written for a **retro
> arcade / pixel-art** look. These prompts emphasize the classic 16-bit
> game-boss aesthetic (chunky pixels, limited palette, bold silhouette) rather
> than smooth modern rendering.
>
> Companion docs: `plan_docs/plan-boss.md` (design) and
> `plan_docs/boss-image-prompts.md` (per-frame sprite-sheet breakdown). Generate
> art, drop it under `public/assets/enemies/boss/<id>/`, and load it through
> `src/assetPath.js`.

Bosses appear on every 10th wave. Each archetype has a **fixed colour identity**
and a **fixed move set**, so its art must read that theme at a glance. The colour
tokens come straight from `CFG.boss.variants` in `src/config.js`.

---

## Global retro style anchor (prepend to EVERY prompt)

> *"Top-down 2D video-game boss sprite in **retro 16-bit pixel-art style**.
> Chunky visible pixels, hard-edged clusters, limited indexed palette, crisp
> 1-pixel dark outline, dithered shading for gradients (no smooth anti-aliasing).
> Bold readable silhouette, vibrant saturated arcade colours, lighting from the
> top. Transparent background, single centered sprite, no text, no UI, no
> drop-shadow on the ground. Render LARGE and imposing (recommended 256×256
> canvas), clearly bigger and more detailed than a normal 64×64 enemy — a true
> end-of-stage boss."*

Keep these as **separate transparent overlays** (the engine animates them in
code, so do not bake them into the body):
- the **energy shield dome** — cyan `#40c4ff`,
- the small **orbiting weak-point nodes** — yellow `#ffeb3b`, ~32×32 each.

Colour tokens are `body / accent (armor trim) / core (eye) / projectile`.

---

## Wave 10 — The Warden · id `warden`

**Implementation status (2026-06-20): complete.** All 21 frames below were
generated, normalized to transparent 256×256 PNGs, and saved under
`public/assets/enemies/boss/warden/`. `GameScene` now loads and displays the
directional idle poses, south-facing walk loop, summon/barrage telegraph and
release frames, phase-3 enrage frame, and four-frame death sequence. The
shield and weak points remain code-drawn overlays. The Monsters gallery uses
the Warden's real south-facing portrait. Other boss archetypes continue using
the primitive fallback until their frame sets are generated.

**Colours:** body `#4a148c` · accent `#9575cd` · core `#ff5252` · proj `#b388ff`
**Phase powers:** P1 `summon` · P2 `summon + barrage` · P3 `summon + barrage`
**Weak points by phase:** 2 / 2 / 3

**Character description (the constant identity — keep it identical in every
prompt below):** *"A massive armored **prison-warden golem**, deep royal-purple
(`#4a148c`) plate armor with lavender (`#9575cd`) trim, blocky riveted pauldrons,
a single glowing red (`#ff5252`) core-eye set in its chest, heavy and stoic.
Small glowing purple weak-point vents on its shoulders."*

**Save all files under:** `public/assets/enemies/boss/warden/`
Every image: same 256×256 canvas, same center point, same body scale, transparent
background, so the engine needs no per-frame offset tuning. Prepend the **Global
retro style anchor** to each prompt.

### 1. Idle 8-direction turnaround (8 prompts)

> Same golem, same scale, only the facing changes. "Top-down" means we read it
> from above, so "facing down (S)" = the camera sees its front/chest, "facing up
> (N)" = we see its back/shoulders, etc.

| # | Facing | File | Prompt (append to style anchor + character description) |
|---|--------|------|---------|
| 1 | Down / South | `warden_idle_s.png` | *"...standing idle, **facing down toward the viewer (south)**, chest core-eye fully visible, shoulder vents framing the front. Symmetrical front pose."* |
| 2 | Up / North | `warden_idle_n.png` | *"...standing idle, **facing up/away (north)**, we see its armored back and the back of its pauldrons, core-eye hidden, back vents glowing faintly. Symmetrical rear pose."* |
| 3 | Left / West | `warden_idle_w.png` | *"...standing idle, **facing left (west)**, strict side profile, one pauldron forward, core-eye glow rimming the chest edge."* |
| 4 | Right / East | `warden_idle_e.png` | *"...standing idle, **facing right (east)**, strict side profile mirrored from the west pose, one pauldron forward."* |
| 5 | Down-Right / SE | `warden_idle_se.png` | *"...standing idle, **facing down-right (south-east)**, three-quarter front view angled to its right, core-eye partly visible."* |
| 6 | Down-Left / SW | `warden_idle_sw.png` | *"...standing idle, **facing down-left (south-west)**, three-quarter front view angled to its left, core-eye partly visible."* |
| 7 | Up-Right / NE | `warden_idle_ne.png` | *"...standing idle, **facing up-right (north-east)**, three-quarter rear view angled to its right, mostly back and shoulder showing."* |
| 8 | Up-Left / NW | `warden_idle_nw.png` | *"...standing idle, **facing up-left (north-west)**, three-quarter rear view angled to its left, mostly back and shoulder showing."* |

### 2. Walk cycle — down-facing, 4 frames

> A heavy, lumbering loop. All four read clearly as the **south/front** pose
> (matching `warden_idle_s.png`); only the legs/weight shift. Loop order is
> 0 → 1 → 2 → 3 → back to 0.

| # | File | Prompt (append to style anchor + character description) |
|---|------|---------|
| 1 | `warden_walk_s_0.png` | *"...facing down (south), **walk frame 1 — contact pose**, left foot planted forward, right foot back, body weight low, slight forward lean."* |
| 2 | `warden_walk_s_1.png` | *"...facing down (south), **walk frame 2 — passing pose**, legs together beneath the body, torso lifted to its highest point, heavy step."* |
| 3 | `warden_walk_s_2.png` | *"...facing down (south), **walk frame 3 — contact pose mirrored**, right foot planted forward, left foot back, body weight low."* |
| 4 | `warden_walk_s_3.png` | *"...facing down (south), **walk frame 4 — passing pose**, legs together beneath the body, torso lifted, heavy step (mirror of frame 2)."* |

### 3. Attack — `summon` (telegraph + release)

| # | File | Prompt (append to style anchor + character description) |
|---|------|---------|
| 1 | `warden_summon_telegraph.png` | *"...facing down, **summon telegraph** — chest armor splitting open along blocky pixel seams to reveal a glowing purple summoning chamber, core-eye flaring brighter, arms spreading wide. Charging up, energy building."* |
| 2 | `warden_summon_release.png` | *"...facing down, **summon release** — chamber wide open and blazing purple, small spectral minion shapes materializing out of it in dithered light, bright burst of summoning energy."* |

### 4. Attack — `barrage` (telegraph + release)

| # | File | Prompt (append to style anchor + character description) |
|---|------|---------|
| 1 | `warden_barrage_telegraph.png` | *"...facing down, **barrage telegraph** — a ring of pixel-clustered purple (`#b388ff`) energy orbs charging in a circle around its body, orbs growing brighter, core-eye glowing intensely. About to fire."* |
| 2 | `warden_barrage_release.png` | *"...facing down, **barrage release** — the purple orb ring firing outward in all directions at once, bright radial muzzle flashes, body braced from the recoil."* |

### 5. Enrage — phase 3 look (1 prompt)

| # | File | Prompt (append to style anchor + character description) |
|---|------|---------|
| 1 | `warden_enrage.png` | *"...facing down, **enraged phase-3 form** — purple plate armor glowing hotter with red cracks spreading through it, core-eye burning fierce red, an aggressive crouched battle stance, faint red heat aura. More menacing and detailed than the idle."* |

### 6. Death sequence — 4 frames

> Plays once on defeat. Frame 0 = intact, frame 3 = fully gone.

| # | File | Prompt (append to style anchor + character description) |
|---|------|---------|
| 1 | `warden_death_0.png` | *"...**death frame 1** — staggering, first cracks splitting the purple armor, core-eye flickering, small pixel sparks escaping the seams."* |
| 2 | `warden_death_1.png` | *"...**death frame 2** — armor blowing apart, chunky purple pixel shards flying outward, core-eye flaring blinding red, internal glow bursting through the cracks."* |
| 3 | `warden_death_2.png` | *"...**death frame 3** — a large purple-and-red pixel explosion engulfing most of the body, only fragments of armor remaining, core overloading."* |
| 4 | `warden_death_3.png` | *"...**death frame 4** — dissipating cloud of scattered purple pixel debris and fading red embers, body almost entirely gone."* |

> **Total for The Warden: 21 images** — 8 idle directions + 4 walk + 2 summon +
> 2 barrage + 1 enrage + 4 death.

---

## Wave 20 — The Juggernaut · id `juggernaut`

**Colours:** body `#1b5e20` · accent `#66bb6a` · core `#ffee58` · proj `#9ccc65`
**Phase powers:** P1 `barrage` · P2 `barrage + charge` · P3 `barrage + charge`
**Weak points by phase:** 2 / 2 / 3

**Character description (constant identity — keep identical in every prompt):**
*"A hulking green armored **bull-juggernaut**, thick mossy-green (`#1b5e20`)
plating with lime (`#66bb6a`) trim, broad horned shoulders built for ramming, a
glowing yellow (`#ffee58`) core in its forehead, glowing lime weak-point vents on
its flanks, built like a battering ram."*

**Save all files under:** `public/assets/enemies/boss/juggernaut/` · same
256×256 canvas, center, scale, transparent. Prepend the **Global retro style
anchor** to every prompt.

### 1. Idle 8-direction turnaround (8 prompts)

| File | Prompt (append to style anchor + character description) |
|------|---------|
| `juggernaut_idle_s.png` | *"...idle, **facing down toward viewer (south)**, front view, forehead core and lowered horns visible."* |
| `juggernaut_idle_n.png` | *"...idle, **facing up/away (north)**, rear view of its armored back and shoulder humps, core hidden."* |
| `juggernaut_idle_w.png` | *"...idle, **facing left (west)**, side profile, horns pointing left, one shoulder forward."* |
| `juggernaut_idle_e.png` | *"...idle, **facing right (east)**, side profile mirrored, horns pointing right."* |
| `juggernaut_idle_se.png` | *"...idle, **facing down-right (south-east)**, three-quarter front angled right, core partly visible."* |
| `juggernaut_idle_sw.png` | *"...idle, **facing down-left (south-west)**, three-quarter front angled left, core partly visible."* |
| `juggernaut_idle_ne.png` | *"...idle, **facing up-right (north-east)**, three-quarter rear angled right."* |
| `juggernaut_idle_nw.png` | *"...idle, **facing up-left (north-west)**, three-quarter rear angled left."* |

### 2. Walk cycle — down-facing, 4 frames (loop 0→1→2→3)

| File | Prompt (append to style anchor + character description) |
|------|---------|
| `juggernaut_walk_s_0.png` | *"...facing down, **walk contact pose**, left foreleg planted forward, heavy stomping gait, head low."* |
| `juggernaut_walk_s_1.png` | *"...facing down, **walk passing pose**, legs gathered, body rising, weight shifting forward."* |
| `juggernaut_walk_s_2.png` | *"...facing down, **walk contact pose mirrored**, right foreleg planted forward."* |
| `juggernaut_walk_s_3.png` | *"...facing down, **walk passing pose** (mirror of frame 2), legs gathered, body rising."* |

### 3. Attack — `barrage` (telegraph + release)

| File | Prompt (append to style anchor + character description) |
|------|---------|
| `juggernaut_barrage_telegraph.png` | *"...facing down, **barrage telegraph** — a ring of lime-green (`#9ccc65`) energy bolts charging around its body, core glowing brighter."* |
| `juggernaut_barrage_release.png` | *"...facing down, **barrage release** — lime energy bolts spraying outward in a radial burst, bright muzzle flashes."* |

### 4. Attack — `charge` (telegraph + release)

| File | Prompt (append to style anchor + character description) |
|------|---------|
| `juggernaut_charge_telegraph.png` | *"...**charge telegraph** — crouched and braced, head lowered, horns forward, glowing yellow thrusters flaring behind it, pawing the ground before a ram."* |
| `juggernaut_charge_release.png` | *"...**charge release** — mid-charge forward lunge, horns leading, motion-streak pixels and a leading green shockwave."* |

### 5. Enrage — phase 3 (1 prompt)

| File | Prompt |
|------|---------|
| `juggernaut_enrage.png` | *"...**enraged phase-3 form** — armor glowing hot, lime cracks blazing across the plates, yellow core burning fierce, steaming nostrils, aggressive braced stance."* |

### 6. Death sequence — 4 frames

| File | Prompt |
|------|---------|
| `juggernaut_death_0.png` | *"...**death frame 1** — staggering, first cracks in the green plating, core flickering, sparks at the seams."* |
| `juggernaut_death_1.png` | *"...**death frame 2** — armor blasting apart into chunky green pixel shards, core flaring blinding yellow."* |
| `juggernaut_death_2.png` | *"...**death frame 3** — large green-and-yellow pixel explosion, only fragments left, core overloading."* |
| `juggernaut_death_3.png` | *"...**death frame 4** — fading cloud of scattered green debris and yellow embers, body nearly gone."* |

> **Total: 21 images** — 8 idle + 4 walk + barrage ×2 + charge ×2 + enrage + death ×4.

---

## Wave 30 — The Hexweaver · id `hexweaver`

**Colours:** body `#0d47a1` · accent `#42a5f5` · core `#80d8ff` · proj `#64b5f6`
**Phase powers:** P1 `beamSweep` · P2 `mirrorClones` · P3 `gravityWell` *(unique kit, one ability per phase — no overlap with other bosses)*
**Weak points by phase:** 2 / 3 / 3

**Character description (constant identity — keep identical in every prompt):**
*"A floating arcane **caster construct**, deep-blue (`#0d47a1`) robed/levitating
body with azure (`#42a5f5`) glowing runes, a bright cyan (`#80d8ff`) core, no
legs — it hovers — with spectral hands weaving spell-circles. Glowing rune
weak-points float at its sides. Mystical."*

**Save all files under:** `public/assets/enemies/boss/hexweaver/` · same 256×256
canvas, center, scale, transparent. Prepend the **Global retro style anchor**.

### 1. Idle 8-direction turnaround (8 prompts)

> It floats, so "walk" is a **hover** loop; facing still rotates the body/hands.

| File | Prompt (append to style anchor + character description) |
|------|---------|
| `hexweaver_idle_s.png` | *"...hovering idle, **facing down toward viewer (south)**, front view, cyan core and spell-circle hands visible."* |
| `hexweaver_idle_n.png` | *"...hovering idle, **facing up/away (north)**, rear view of its robed back, core hidden, back runes glowing."* |
| `hexweaver_idle_w.png` | *"...hovering idle, **facing left (west)**, side profile, hands weaving leftward."* |
| `hexweaver_idle_e.png` | *"...hovering idle, **facing right (east)**, side profile mirrored."* |
| `hexweaver_idle_se.png` | *"...hovering idle, **facing down-right (south-east)**, three-quarter front angled right."* |
| `hexweaver_idle_sw.png` | *"...hovering idle, **facing down-left (south-west)**, three-quarter front angled left."* |
| `hexweaver_idle_ne.png` | *"...hovering idle, **facing up-right (north-east)**, three-quarter rear angled right."* |
| `hexweaver_idle_nw.png` | *"...hovering idle, **facing up-left (north-west)**, three-quarter rear angled left."* |

### 2. Hover cycle — down-facing, 4 frames (loop 0→1→2→3)

| File | Prompt |
|------|---------|
| `hexweaver_walk_s_0.png` | *"...facing down, **hover frame 1**, body at lowest bob, robe hem settled, runes dim."* |
| `hexweaver_walk_s_1.png` | *"...facing down, **hover frame 2**, body rising, robe lifting, runes brightening."* |
| `hexweaver_walk_s_2.png` | *"...facing down, **hover frame 3**, body at highest bob, robe billowed, runes brightest."* |
| `hexweaver_walk_s_3.png` | *"...facing down, **hover frame 4**, body descending, robe settling (mirror of frame 2)."* |

### 3. Attack — `beamSweep` (telegraph + release)

| File | Prompt |
|------|---------|
| `hexweaver_beamSweep_telegraph.png` | *"...**beamSweep telegraph** — both spectral hands tracing a glowing azure spell-circle, a thin aiming line of blue light forming, charging a beam."* |
| `hexweaver_beamSweep_release.png` | *"...**beamSweep release** — firing a wide sweeping beam of bright cyan arcane energy, the beam arcing across the scene."* |

### 4. Attack — `mirrorClones` (telegraph + release)

| File | Prompt |
|------|---------|
| `hexweaver_mirrorClones_telegraph.png` | *"...**mirrorClones telegraph** — its outline shimmering and splitting, translucent blue duplicate silhouettes peeling away from its body."* |
| `hexweaver_mirrorClones_release.png` | *"...**mirrorClones release** — several semi-transparent azure mirror-images of the caster fanned out around the original, all identical."* |

### 5. Attack — `gravityWell` (telegraph + release)

| File | Prompt |
|------|---------|
| `hexweaver_gravityWell_telegraph.png` | *"...**gravityWell telegraph** — conjuring a dark swirling blue vortex in front of it, runes spiraling inward, space distorting."* |
| `hexweaver_gravityWell_release.png` | *"...**gravityWell release** — a collapsing blue gravity vortex pulling pixel debris and light inward, intense warping core."* |

### 6. Enrage — phase 3 (1 prompt)

| File | Prompt |
|------|---------|
| `hexweaver_enrage.png` | *"...**enraged phase-3 form** — runes blazing white-hot azure, core overcharged and pulsing, extra spell-circles orbiting, robe whipping with arcane wind."* |

### 7. Death sequence — 4 frames

| File | Prompt |
|------|---------|
| `hexweaver_death_0.png` | *"...**death frame 1** — runes flickering and shattering, robe tearing, core destabilizing."* |
| `hexweaver_death_1.png` | *"...**death frame 2** — body fracturing into blue glassy pixel shards, spell-circles collapsing."* |
| `hexweaver_death_2.png` | *"...**death frame 3** — a blue arcane implosion-then-burst, only fragments and stray runes remaining."* |
| `hexweaver_death_3.png` | *"...**death frame 4** — fading scatter of blue rune-pixels and dissipating cyan light, body gone."* |

> **Total: 23 images** — 8 idle + 4 hover + beamSweep ×2 + mirrorClones ×2 + gravityWell ×2 + enrage + death ×4.

---

## Wave 40 — The Bombardier · id `bombardier`

**Colours:** body `#bf360c` · accent `#ff8a65` · core `#ffd54f` · proj `#ff7043`
**Phase powers:** P1 `aimedVolley` · P2 `aimedVolley + barrage` · P3 `aimedVolley + barrage + charge`
**Weak points by phase:** 2 / 2 / 3

**Character description (constant identity — keep identical in every prompt):**
*"A heavily armed **artillery-walker**, burnt-orange (`#bf360c`) armor with coral
(`#ff8a65`) trim, an amber (`#ffd54f`) core, multiple cannon barrels and missile
ports bristling from its body, squat armored legs, glowing amber weak-point vents
between the gun ports."*

**Save all files under:** `public/assets/enemies/boss/bombardier/` · same 256×256
canvas, center, scale, transparent. Prepend the **Global retro style anchor**.

### 1. Idle 8-direction turnaround (8 prompts)

| File | Prompt |
|------|---------|
| `bombardier_idle_s.png` | *"...idle, **facing down toward viewer (south)**, front view, cannon barrels and amber core facing the viewer."* |
| `bombardier_idle_n.png` | *"...idle, **facing up/away (north)**, rear view, exhaust vents and back armor, core hidden."* |
| `bombardier_idle_w.png` | *"...idle, **facing left (west)**, side profile, barrels pointing left."* |
| `bombardier_idle_e.png` | *"...idle, **facing right (east)**, side profile mirrored, barrels pointing right."* |
| `bombardier_idle_se.png` | *"...idle, **facing down-right (south-east)**, three-quarter front angled right."* |
| `bombardier_idle_sw.png` | *"...idle, **facing down-left (south-west)**, three-quarter front angled left."* |
| `bombardier_idle_ne.png` | *"...idle, **facing up-right (north-east)**, three-quarter rear angled right."* |
| `bombardier_idle_nw.png` | *"...idle, **facing up-left (north-west)**, three-quarter rear angled left."* |

### 2. Walk cycle — down-facing, 4 frames (loop 0→1→2→3)

| File | Prompt |
|------|---------|
| `bombardier_walk_s_0.png` | *"...facing down, **walk contact pose**, left leg forward, barrels swaying, mechanical stomp."* |
| `bombardier_walk_s_1.png` | *"...facing down, **walk passing pose**, legs gathered, chassis rising."* |
| `bombardier_walk_s_2.png` | *"...facing down, **walk contact pose mirrored**, right leg forward."* |
| `bombardier_walk_s_3.png` | *"...facing down, **walk passing pose** (mirror of frame 2)."* |

### 3. Attack — `aimedVolley` (telegraph + release)

| File | Prompt |
|------|---------|
| `bombardier_aimedVolley_telegraph.png` | *"...**aimedVolley telegraph** — cannon barrels swiveling toward a target and glowing hot at the muzzles, aiming lines forming."* |
| `bombardier_aimedVolley_release.png` | *"...**aimedVolley release** — firing a tight fan of glowing orange (`#ff7043`) shells forward, bright muzzle flashes."* |

### 4. Attack — `barrage` (telegraph + release)

| File | Prompt |
|------|---------|
| `bombardier_barrage_telegraph.png` | *"...**barrage telegraph** — all weapon ports glowing at once, charging a radial volley, core flaring."* |
| `bombardier_barrage_release.png` | *"...**barrage release** — every port firing outward in a radial burst, bright muzzle glow all around."* |

### 5. Attack — `charge` (telegraph + release)

| File | Prompt |
|------|---------|
| `bombardier_charge_telegraph.png` | *"...**charge telegraph** — bracing low, rear thrusters igniting, telegraphing a forward lunge."* |
| `bombardier_charge_release.png` | *"...**charge release** — mid-charge forward ram with motion streaks and a leading shockwave."* |

### 6. Enrage — phase 3 (1 prompt)

| File | Prompt |
|------|---------|
| `bombardier_enrage.png` | *"...**enraged phase-3 form** — armor glowing hot, orange cracks across the plating, every barrel red-hot, amber core overloaded, smoke venting."* |

### 7. Death sequence — 4 frames

| File | Prompt |
|------|---------|
| `bombardier_death_0.png` | *"...**death frame 1** — listing, first cracks and a barrel exploding, sparks venting."* |
| `bombardier_death_1.png` | *"...**death frame 2** — ammo cooking off, chunky orange pixel shards flying, core flaring."* |
| `bombardier_death_2.png` | *"...**death frame 3** — large orange-and-amber chain explosion, only fragments remaining."* |
| `bombardier_death_3.png` | *"...**death frame 4** — fading cloud of orange debris and amber embers, body gone."* |

> **Total: 23 images** — 8 idle + 4 walk + aimedVolley ×2 + barrage ×2 + charge ×2 + enrage + death ×4.

---

## Wave 50 — The Phantom · id `phantom`

**Colours:** body `#004d40` · accent `#4db6ac` · core `#b2ff59` · proj `#1de9b6`
**Phase powers:** P1 `barrage + nova` · P2 `barrage + nova` · P3 `barrage + nova + charge + dotField`
**Weak points by phase:** 3 / 3 / 3

**Character description (constant identity — keep identical in every prompt):**
*"A ghostly translucent **specter**, dark-teal (`#004d40`) smoky semi-transparent
form with aqua (`#4db6ac`) glowing edges, a piercing lime-green (`#b2ff59`) core,
ethereal wisps trailing off its body, no solid legs — it drifts. Glowing
weak-point motes hover within its mist."*

**Save all files under:** `public/assets/enemies/boss/phantom/` · same 256×256
canvas, center, scale, transparent. Keep the body semi-transparent. Prepend the
**Global retro style anchor**.

### 1. Idle 8-direction turnaround (8 prompts)

| File | Prompt |
|------|---------|
| `phantom_idle_s.png` | *"...drifting idle, **facing down toward viewer (south)**, front view, lime core and aqua edges visible through the mist."* |
| `phantom_idle_n.png` | *"...drifting idle, **facing up/away (north)**, rear view, trailing wisps, core dim."* |
| `phantom_idle_w.png` | *"...drifting idle, **facing left (west)**, side profile, wisps streaming right."* |
| `phantom_idle_e.png` | *"...drifting idle, **facing right (east)**, side profile mirrored."* |
| `phantom_idle_se.png` | *"...drifting idle, **facing down-right (south-east)**, three-quarter front angled right."* |
| `phantom_idle_sw.png` | *"...drifting idle, **facing down-left (south-west)**, three-quarter front angled left."* |
| `phantom_idle_ne.png` | *"...drifting idle, **facing up-right (north-east)**, three-quarter rear angled right."* |
| `phantom_idle_nw.png` | *"...drifting idle, **facing up-left (north-west)**, three-quarter rear angled left."* |

### 2. Drift cycle — down-facing, 4 frames (loop 0→1→2→3)

| File | Prompt |
|------|---------|
| `phantom_walk_s_0.png` | *"...facing down, **drift frame 1**, mist compact, wisps short, core dim."* |
| `phantom_walk_s_1.png` | *"...facing down, **drift frame 2**, mist expanding, wisps lengthening, core brighter."* |
| `phantom_walk_s_2.png` | *"...facing down, **drift frame 3**, mist widest, wisps longest, core brightest."* |
| `phantom_walk_s_3.png` | *"...facing down, **drift frame 4**, mist contracting (mirror of frame 2)."* |

### 3. Attack — `barrage` (telegraph + release)

| File | Prompt |
|------|---------|
| `phantom_barrage_telegraph.png` | *"...**barrage telegraph** — a ring of spectral teal (`#1de9b6`) motes charging around its mist, core glowing."* |
| `phantom_barrage_release.png` | *"...**barrage release** — radial spray of spectral teal projectiles bursting outward."* |

### 4. Attack — `nova` (telegraph + release)

| File | Prompt |
|------|---------|
| `phantom_nova_telegraph.png` | *"...**nova telegraph** — a haunting thin ring of green spectral energy forming and expanding outward as a warning."* |
| `phantom_nova_release.png` | *"...**nova release** — the ring detonating into a bright expanding burst of green spectral energy."* |

### 5. Attack — `charge` (telegraph + release)

| File | Prompt |
|------|---------|
| `phantom_charge_telegraph.png` | *"...**charge telegraph** — mist compressing and elongating, gathering for a dash."* |
| `phantom_charge_release.png` | *"...**charge release** — streaking phantom dash, heavy motion blur and teal afterimages."* |

### 6. Attack — `dotField` (telegraph + release)

| File | Prompt |
|------|---------|
| `phantom_dotField_telegraph.png` | *"...**dotField telegraph** — exhaling a spreading low cloud of sickly green spectral fog beneath it."* |
| `phantom_dotField_release.png` | *"...**dotField release** — a lingering field of glowing green poison mist with drifting toxic motes."* |

### 7. Enrage — phase 3 (1 prompt)

| File | Prompt |
|------|---------|
| `phantom_enrage.png` | *"...**enraged phase-3 form** — mist roiling violently, edges blazing acid-green, core searing bright, multiple shrieking wisp-faces emerging."* |

### 8. Death sequence — 4 frames

| File | Prompt |
|------|---------|
| `phantom_death_0.png` | *"...**death frame 1** — form flickering and tearing, core unstable."* |
| `phantom_death_1.png` | *"...**death frame 2** — mist body shredding into green pixel wisps, core flaring."* |
| `phantom_death_2.png` | *"...**death frame 3** — a green spectral burst scattering the remaining mist."* |
| `phantom_death_3.png` | *"...**death frame 4** — last green wisps and motes fading to nothing."* |

> **Total: 25 images** — 8 idle + 4 drift + barrage ×2 + nova ×2 + charge ×2 + dotField ×2 + enrage + death ×4.

---

## Wave 60 — The Overlord · id `overlord`

**Colours:** body `#b71c1c` · accent `#ef5350` · core `#ffca28` · proj `#ff5252`
**Phase powers:** P1 `missiles + barrage` · P2 `missiles + barrage + charge` · P3 `missiles + barrage + charge + nova`
**Weak points by phase:** 2 / 3 / 3
*(Note: `missiles` summons homing missiles, not enemy minions.)*

**Character description (constant identity — keep identical in every prompt):**
*"A demonic **warlord commander**, crimson-red (`#b71c1c`) armored body with
scarlet (`#ef5350`) trim, a blazing gold (`#ffca28`) core, a jagged crown and
cape-like energy, regal and menacing, shoulder-mounted missile racks, glowing
red weak-point vents on its chest."*

**Save all files under:** `public/assets/enemies/boss/overlord/` · same 256×256
canvas, center, scale, transparent. Prepend the **Global retro style anchor**.

### 1. Idle 8-direction turnaround (8 prompts)

| File | Prompt |
|------|---------|
| `overlord_idle_s.png` | *"...idle, **facing down toward viewer (south)**, front view, gold core, crown and chest vents visible."* |
| `overlord_idle_n.png` | *"...idle, **facing up/away (north)**, rear view, cape-like energy and back of crown, core hidden."* |
| `overlord_idle_w.png` | *"...idle, **facing left (west)**, side profile, cape trailing right."* |
| `overlord_idle_e.png` | *"...idle, **facing right (east)**, side profile mirrored."* |
| `overlord_idle_se.png` | *"...idle, **facing down-right (south-east)**, three-quarter front angled right."* |
| `overlord_idle_sw.png` | *"...idle, **facing down-left (south-west)**, three-quarter front angled left."* |
| `overlord_idle_ne.png` | *"...idle, **facing up-right (north-east)**, three-quarter rear angled right."* |
| `overlord_idle_nw.png` | *"...idle, **facing up-left (north-west)**, three-quarter rear angled left."* |

### 2. Walk cycle — down-facing, 4 frames (loop 0→1→2→3)

| File | Prompt |
|------|---------|
| `overlord_walk_s_0.png` | *"...facing down, **walk contact pose**, left foot forward, cape swaying, imperious stride."* |
| `overlord_walk_s_1.png` | *"...facing down, **walk passing pose**, legs gathered, body rising, cape lifting."* |
| `overlord_walk_s_2.png` | *"...facing down, **walk contact pose mirrored**, right foot forward."* |
| `overlord_walk_s_3.png` | *"...facing down, **walk passing pose** (mirror of frame 2)."* |

### 3. Attack — `missiles` (telegraph + release)

| File | Prompt |
|------|---------|
| `overlord_missiles_telegraph.png` | *"...**missiles telegraph** — shoulder missile racks opening and glowing, missiles arming with red trails warming up."* |
| `overlord_missiles_release.png` | *"...**missiles release** — a salvo of glowing homing missiles launching upward and outward with red exhaust trails."* |

### 4. Attack — `barrage` (telegraph + release)

| File | Prompt |
|------|---------|
| `overlord_barrage_telegraph.png` | *"...**barrage telegraph** — a ring of crimson hellfire orbs charging around its body, core blazing."* |
| `overlord_barrage_release.png` | *"...**barrage release** — radial burst of crimson (`#ff5252`) hellfire orbs firing outward."* |

### 5. Attack — `charge` (telegraph + release)

| File | Prompt |
|------|---------|
| `overlord_charge_telegraph.png` | *"...**charge telegraph** — crouched and wreathed in flame, gathering for a lunge."* |
| `overlord_charge_release.png` | *"...**charge release** — lunging forward wreathed in fire, leading shockwave, motion streaks."* |

### 6. Attack — `nova` (telegraph + release)

| File | Prompt |
|------|---------|
| `overlord_nova_telegraph.png` | *"...**nova telegraph** — an expanding ring of red infernal energy forming as a warning."* |
| `overlord_nova_release.png` | *"...**nova release** — the ring detonating into a fiery red expanding burst."* |

### 7. Enrage — phase 3 (1 prompt)

| File | Prompt |
|------|---------|
| `overlord_enrage.png` | *"...**enraged phase-3 form** — armor glowing molten, crown blazing, cape erupting into roaring fire, gold core white-hot, hellish aura."* |

### 8. Death sequence — 4 frames

| File | Prompt |
|------|---------|
| `overlord_death_0.png` | *"...**death frame 1** — staggering, armor cracking, crown chipping, core flickering."* |
| `overlord_death_1.png` | *"...**death frame 2** — armor blasting apart into crimson pixel shards, core flaring gold."* |
| `overlord_death_2.png` | *"...**death frame 3** — large crimson-and-gold infernal explosion, only fragments remaining."* |
| `overlord_death_3.png` | *"...**death frame 4** — fading cloud of red debris and gold embers, body gone."* |

> **Total: 25 images** — 8 idle + 4 walk + missiles ×2 + barrage ×2 + charge ×2 + nova ×2 + enrage + death ×4.

---

## Wave 70 — The Tempest · id `tempest`

**Colours:** body `#006064` · accent `#26c6da` · core `#e0f7fa` · proj `#00e5ff`
**Phase powers:** P1 `spiral + aimedVolley` · P2 `spiral + aimedVolley + charge` · P3 `spiral + aimedVolley + charge + nova`
**Weak points by phase:** 3 / 3 / 4

**Character description (constant identity — keep identical in every prompt):**
*"A **storm elemental**, dark-cyan (`#006064`) swirling-cloud body with bright
cyan (`#26c6da`) lightning arcs crackling across it, a brilliant near-white
(`#e0f7fa`) core, turbulent and churning, no solid legs — a hovering thunderhead.
Glowing weak-point sparks orbit within the cloud."*

**Save all files under:** `public/assets/enemies/boss/tempest/` · same 256×256
canvas, center, scale, transparent. Prepend the **Global retro style anchor**.

### 1. Idle 8-direction turnaround (8 prompts)

| File | Prompt |
|------|---------|
| `tempest_idle_s.png` | *"...hovering idle, **facing down toward viewer (south)**, front view, white core glaring through the cloud, lightning arcing toward the viewer."* |
| `tempest_idle_n.png` | *"...hovering idle, **facing up/away (north)**, rear view of the thunderhead, core dim."* |
| `tempest_idle_w.png` | *"...hovering idle, **facing left (west)**, cloud profile, lightning trailing right."* |
| `tempest_idle_e.png` | *"...hovering idle, **facing right (east)**, profile mirrored."* |
| `tempest_idle_se.png` | *"...hovering idle, **facing down-right (south-east)**, three-quarter front angled right."* |
| `tempest_idle_sw.png` | *"...hovering idle, **facing down-left (south-west)**, three-quarter front angled left."* |
| `tempest_idle_ne.png` | *"...hovering idle, **facing up-right (north-east)**, three-quarter rear angled right."* |
| `tempest_idle_nw.png` | *"...hovering idle, **facing up-left (north-west)**, three-quarter rear angled left."* |

### 2. Hover cycle — down-facing, 4 frames (loop 0→1→2→3)

| File | Prompt |
|------|---------|
| `tempest_walk_s_0.png` | *"...facing down, **hover frame 1**, cloud compact, few arcs, core dim."* |
| `tempest_walk_s_1.png` | *"...facing down, **hover frame 2**, cloud swelling, more lightning, core brighter."* |
| `tempest_walk_s_2.png` | *"...facing down, **hover frame 3**, cloud largest, lightning peak, core brightest."* |
| `tempest_walk_s_3.png` | *"...facing down, **hover frame 4**, cloud contracting (mirror of frame 2)."* |

### 3. Attack — `spiral` (telegraph + release)

| File | Prompt |
|------|---------|
| `tempest_spiral_telegraph.png` | *"...**spiral telegraph** — lightning arcs winding up into rotating spiral arms, core spinning brighter."* |
| `tempest_spiral_release.png` | *"...**spiral release** — spiraling arms of cyan (`#00e5ff`) lightning bolts spinning outward."* |

### 4. Attack — `aimedVolley` (telegraph + release)

| File | Prompt |
|------|---------|
| `tempest_aimedVolley_telegraph.png` | *"...**aimedVolley telegraph** — lightning gathering into a focused forward-pointing arc, aiming line forming."* |
| `tempest_aimedVolley_release.png` | *"...**aimedVolley release** — a focused fan of cyan lightning lances firing forward."* |

### 5. Attack — `charge` (telegraph + release)

| File | Prompt |
|------|---------|
| `tempest_charge_telegraph.png` | *"...**charge telegraph** — cloud compressing into a dense charged ball, crackling, about to dash."* |
| `tempest_charge_release.png` | *"...**charge release** — a lightning-fast dash, electric trail and motion streaks."* |

### 6. Attack — `nova` (telegraph + release)

| File | Prompt |
|------|---------|
| `tempest_nova_telegraph.png` | *"...**nova telegraph** — an expanding ring of cyan storm energy forming as a warning."* |
| `tempest_nova_release.png` | *"...**nova release** — a thunderclap burst, the ring detonating into a bright cyan shockwave."* |

### 7. Enrage — phase 3 (1 prompt)

| File | Prompt |
|------|---------|
| `tempest_enrage.png` | *"...**enraged phase-3 form** — cloud blackened and massive, lightning crackling violently all over, white core blinding, a raging storm aura."* |

### 8. Death sequence — 4 frames

| File | Prompt |
|------|---------|
| `tempest_death_0.png` | *"...**death frame 1** — cloud destabilizing, erratic lightning, core flickering."* |
| `tempest_death_1.png` | *"...**death frame 2** — cloud body bursting into cyan pixel sparks, core flaring white."* |
| `tempest_death_2.png` | *"...**death frame 3** — a cyan electric burst scattering the cloud, only sparks remaining."* |
| `tempest_death_3.png` | *"...**death frame 4** — last cyan sparks fading and dissipating, body gone."* |

> **Total: 25 images** — 8 idle + 4 hover + spiral ×2 + aimedVolley ×2 + charge ×2 + nova ×2 + enrage + death ×4.

---

## Wave 80 — The Colossus · id `colossus`

**Colours:** body `#37474f` · accent `#90a4ae` · core `#ff8a65` · proj `#b0bec5`
**Phase powers:** P1 `charge + barrage` · P2 `charge + barrage + shieldSlam` · P3 `charge + barrage + shieldSlam + spiral`
**Weak points by phase:** 2 / 3 / 4

**Character description (constant identity — keep identical in every prompt):**
*"A colossal **steel war-golem**, gunmetal-grey (`#37474f`) heavy industrial
plating with light-steel (`#90a4ae`) trim, a glowing orange (`#ff8a65`) furnace
core in its chest, massive armored fists, brutal and ponderous. Glowing orange
weak-point furnace vents on its torso."*

**Save all files under:** `public/assets/enemies/boss/colossus/` · same 256×256
canvas, center, scale, transparent. Prepend the **Global retro style anchor**.

### 1. Idle 8-direction turnaround (8 prompts)

| File | Prompt |
|------|---------|
| `colossus_idle_s.png` | *"...idle, **facing down toward viewer (south)**, front view, orange furnace core and giant fists visible."* |
| `colossus_idle_n.png` | *"...idle, **facing up/away (north)**, rear view of its massive back plating, core hidden."* |
| `colossus_idle_w.png` | *"...idle, **facing left (west)**, side profile, one fist forward."* |
| `colossus_idle_e.png` | *"...idle, **facing right (east)**, side profile mirrored."* |
| `colossus_idle_se.png` | *"...idle, **facing down-right (south-east)**, three-quarter front angled right."* |
| `colossus_idle_sw.png` | *"...idle, **facing down-left (south-west)**, three-quarter front angled left."* |
| `colossus_idle_ne.png` | *"...idle, **facing up-right (north-east)**, three-quarter rear angled right."* |
| `colossus_idle_nw.png` | *"...idle, **facing up-left (north-west)**, three-quarter rear angled left."* |

### 2. Walk cycle — down-facing, 4 frames (loop 0→1→2→3)

| File | Prompt |
|------|---------|
| `colossus_walk_s_0.png` | *"...facing down, **walk contact pose**, left foot crashing forward, ponderous heavy stomp."* |
| `colossus_walk_s_1.png` | *"...facing down, **walk passing pose**, legs gathered, huge body rising."* |
| `colossus_walk_s_2.png` | *"...facing down, **walk contact pose mirrored**, right foot crashing forward."* |
| `colossus_walk_s_3.png` | *"...facing down, **walk passing pose** (mirror of frame 2)."* |

### 3. Attack — `charge` (telegraph + release)

| File | Prompt |
|------|---------|
| `colossus_charge_telegraph.png` | *"...**charge telegraph** — bracing low, fists clenched, furnace core flaring, about to ram."* |
| `colossus_charge_release.png` | *"...**charge release** — mid-charge ground-cracking ram, leading shockwave and motion streaks."* |

### 4. Attack — `barrage` (telegraph + release)

| File | Prompt |
|------|---------|
| `colossus_barrage_telegraph.png` | *"...**barrage telegraph** — a ring of grey (`#b0bec5`) metal slugs charging around its body, vents glowing."* |
| `colossus_barrage_release.png` | *"...**barrage release** — radial burst of grey metal slugs firing outward."* |

### 5. Attack — `shieldSlam` (telegraph + release)

| File | Prompt |
|------|---------|
| `colossus_shieldSlam_telegraph.png` | *"...**shieldSlam telegraph** — raising both fists high overhead, furnace core blazing, about to slam."* |
| `colossus_shieldSlam_release.png` | *"...**shieldSlam release** — slamming both fists down, re-erecting a cyan energy shield dome with a radial shockwave ring."* |

### 6. Attack — `spiral` (telegraph + release)

| File | Prompt |
|------|---------|
| `colossus_spiral_telegraph.png` | *"...**spiral telegraph** — beginning to spin, debris-rounds gathering into rotating arms."* |
| `colossus_spiral_release.png` | *"...**spiral release** — spinning while flinging spiraling grey debris-rounds outward."* |

### 7. Enrage — phase 3 (1 prompt)

| File | Prompt |
|------|---------|
| `colossus_enrage.png` | *"...**enraged phase-3 form** — furnace core roaring white-orange, glowing molten cracks across the grey plating, steam and sparks venting, fists ablaze."* |

### 8. Death sequence — 4 frames

| File | Prompt |
|------|---------|
| `colossus_death_0.png` | *"...**death frame 1** — toppling, plating cracking, furnace core flickering and venting."* |
| `colossus_death_1.png` | *"...**death frame 2** — armor blasting apart into chunky grey pixel shards, core flaring orange."* |
| `colossus_death_2.png` | *"...**death frame 3** — large grey-and-orange explosion, furnace core overloading, only fragments left."* |
| `colossus_death_3.png` | *"...**death frame 4** — fading cloud of grey debris and orange embers, body gone."* |

> **Total: 25 images** — 8 idle + 4 walk + charge ×2 + barrage ×2 + shieldSlam ×2 + spiral ×2 + enrage + death ×4.

---

## Wave 90 — The Voidcaller · id `voidcaller`

**Colours:** body `#4a0072` · accent `#ce93d8` · core `#ea80fc` · proj `#e040fb`
**Phase powers:** P1 `spiral + summon + nova` · P2 `spiral + summon + nova + aimedVolley` · P3 `spiral + summon + nova + aimedVolley + charge`
**Weak points by phase:** 3 / 3 / 4

**Character description (constant identity — keep identical in every prompt):**
*"An eldritch **void entity**, near-black violet (`#4a0072`) body with orchid
(`#ce93d8`) glowing tendrils, a searing magenta (`#ea80fc`) core, warped reality
and star-flecked darkness swirling around it, alien and unsettling, floating.
Glowing magenta weak-point eyes scattered across its form."*

**Save all files under:** `public/assets/enemies/boss/voidcaller/` · same 256×256
canvas, center, scale, transparent. Prepend the **Global retro style anchor**.

### 1. Idle 8-direction turnaround (8 prompts)

| File | Prompt |
|------|---------|
| `voidcaller_idle_s.png` | *"...floating idle, **facing down toward viewer (south)**, front view, magenta core and forward tendrils visible."* |
| `voidcaller_idle_n.png` | *"...floating idle, **facing up/away (north)**, rear view, trailing tendrils, core dim."* |
| `voidcaller_idle_w.png` | *"...floating idle, **facing left (west)**, profile, tendrils streaming right."* |
| `voidcaller_idle_e.png` | *"...floating idle, **facing right (east)**, profile mirrored."* |
| `voidcaller_idle_se.png` | *"...floating idle, **facing down-right (south-east)**, three-quarter front angled right."* |
| `voidcaller_idle_sw.png` | *"...floating idle, **facing down-left (south-west)**, three-quarter front angled left."* |
| `voidcaller_idle_ne.png` | *"...floating idle, **facing up-right (north-east)**, three-quarter rear angled right."* |
| `voidcaller_idle_nw.png` | *"...floating idle, **facing up-left (north-west)**, three-quarter rear angled left."* |

### 2. Float cycle — down-facing, 4 frames (loop 0→1→2→3)

| File | Prompt |
|------|---------|
| `voidcaller_walk_s_0.png` | *"...facing down, **float frame 1**, tendrils curled in, core dim, body at lowest bob."* |
| `voidcaller_walk_s_1.png` | *"...facing down, **float frame 2**, tendrils unfurling, body rising, core brighter."* |
| `voidcaller_walk_s_2.png` | *"...facing down, **float frame 3**, tendrils splayed wide, body highest, core brightest."* |
| `voidcaller_walk_s_3.png` | *"...facing down, **float frame 4**, tendrils drawing back (mirror of frame 2)."* |

### 3. Attack — `spiral` (telegraph + release)

| File | Prompt |
|------|---------|
| `voidcaller_spiral_telegraph.png` | *"...**spiral telegraph** — tendrils winding into rotating spiral arms, core spinning."* |
| `voidcaller_spiral_release.png` | *"...**spiral release** — spiraling arms of magenta (`#e040fb`) void bolts spinning outward."* |

### 4. Attack — `summon` (telegraph + release)

| File | Prompt |
|------|---------|
| `voidcaller_summon_telegraph.png` | *"...**summon telegraph** — dark void rifts cracking open around it, edges glowing magenta."* |
| `voidcaller_summon_release.png` | *"...**summon release** — dark minions crawling out of the open void rifts."* |

### 5. Attack — `nova` (telegraph + release)

| File | Prompt |
|------|---------|
| `voidcaller_nova_telegraph.png` | *"...**nova telegraph** — a ring of void energy first collapsing inward then beginning to expand as a warning."* |
| `voidcaller_nova_release.png` | *"...**nova release** — the ring detonating into an expanding magenta void burst."* |

### 6. Attack — `aimedVolley` (telegraph + release)

| File | Prompt |
|------|---------|
| `voidcaller_aimedVolley_telegraph.png` | *"...**aimedVolley telegraph** — tendrils aligning into a forward-pointing focus, aiming line forming."* |
| `voidcaller_aimedVolley_release.png` | *"...**aimedVolley release** — a focused fan of magenta void lances firing toward a target."* |

### 7. Attack — `charge` (telegraph + release)

| File | Prompt |
|------|---------|
| `voidcaller_charge_telegraph.png` | *"...**charge telegraph** — flickering/blinking, gathering void energy for a teleport-dash."* |
| `voidcaller_charge_release.png` | *"...**charge release** — blinking forward in a streak of void energy, warped afterimage trail."* |

### 8. Enrage — phase 3 (1 prompt)

| File | Prompt |
|------|---------|
| `voidcaller_enrage.png` | *"...**enraged phase-3 form** — tendrils multiplying and lashing, core searing white-magenta, reality tearing violently around it, more eyes opening."* |

### 9. Death sequence — 4 frames

| File | Prompt |
|------|---------|
| `voidcaller_death_0.png` | *"...**death frame 1** — form destabilizing, tendrils recoiling, core flickering, rifts collapsing."* |
| `voidcaller_death_1.png` | *"...**death frame 2** — body fracturing into violet-and-magenta pixel shards, core flaring."* |
| `voidcaller_death_2.png` | *"...**death frame 3** — a magenta void implosion-then-burst, only fragments and stray eyes remaining."* |
| `voidcaller_death_3.png` | *"...**death frame 4** — last violet shards and magenta light collapsing into nothing."* |

> **Total: 27 images** — 8 idle + 4 float + spiral ×2 + summon ×2 + nova ×2 + aimedVolley ×2 + charge ×2 + enrage + death ×4.

---

## Wave 100 — The Annihilator (FINAL BOSS) · id `annihilator`

**Colours:** body `#311b92` · accent `#ffd740` · core `#ff1744` · proj `#ffea00`
**Phase powers:** P1 `barrage + spiral + aimedVolley` · P2 `+ charge + summon` · P3 `+ nova + shieldSlam` (all seven)
**Weak points by phase:** 3 / 4 / 4

**Character description (constant identity — keep identical in every prompt):**
*"The ultimate apocalyptic **war-machine boss**, deep-indigo (`#311b92`) armor
edged with brilliant gold (`#ffd740`) filigree, a searing red (`#ff1744`) core,
ornate and overwhelming, countless weapon ports, radiant golden energy — make it
the most detailed and intimidating of all bosses. Glowing red weak-point reactors
across its frame."*

**Save all files under:** `public/assets/enemies/boss/annihilator/` · same
256×256 canvas, center, scale, transparent. Prepend the **Global retro style
anchor** — and push the detail/intimidation higher than every other boss.

### 1. Idle 8-direction turnaround (8 prompts)

| File | Prompt |
|------|---------|
| `annihilator_idle_s.png` | *"...idle, **facing down toward viewer (south)**, front view, red core and gold filigree blazing, weapon ports facing the viewer."* |
| `annihilator_idle_n.png` | *"...idle, **facing up/away (north)**, rear view of its ornate indigo-and-gold back, core hidden."* |
| `annihilator_idle_w.png` | *"...idle, **facing left (west)**, side profile, weapon ports along the flank."* |
| `annihilator_idle_e.png` | *"...idle, **facing right (east)**, side profile mirrored."* |
| `annihilator_idle_se.png` | *"...idle, **facing down-right (south-east)**, three-quarter front angled right."* |
| `annihilator_idle_sw.png` | *"...idle, **facing down-left (south-west)**, three-quarter front angled left."* |
| `annihilator_idle_ne.png` | *"...idle, **facing up-right (north-east)**, three-quarter rear angled right."* |
| `annihilator_idle_nw.png` | *"...idle, **facing up-left (north-west)**, three-quarter rear angled left."* |

### 2. Walk cycle — down-facing, 4 frames (loop 0→1→2→3)

| File | Prompt |
|------|---------|
| `annihilator_walk_s_0.png` | *"...facing down, **walk contact pose**, left leg forward, towering imperial advance, gold filigree catching light."* |
| `annihilator_walk_s_1.png` | *"...facing down, **walk passing pose**, legs gathered, immense body rising."* |
| `annihilator_walk_s_2.png` | *"...facing down, **walk contact pose mirrored**, right leg forward."* |
| `annihilator_walk_s_3.png` | *"...facing down, **walk passing pose** (mirror of frame 2)."* |

### 3. Attack — `barrage` (telegraph + release)

| File | Prompt |
|------|---------|
| `annihilator_barrage_telegraph.png` | *"...**barrage telegraph** — every weapon port charging with golden energy, core blazing."* |
| `annihilator_barrage_release.png` | *"...**barrage release** — every port firing a full radial storm of golden (`#ffea00`) bolts."* |

### 4. Attack — `spiral` (telegraph + release)

| File | Prompt |
|------|---------|
| `annihilator_spiral_telegraph.png` | *"...**spiral telegraph** — golden energy winding into rotating spiral arms, body beginning to rotate."* |
| `annihilator_spiral_release.png` | *"...**spiral release** — spiraling golden energy arms sweeping outward across the arena."* |

### 5. Attack — `aimedVolley` (telegraph + release)

| File | Prompt |
|------|---------|
| `annihilator_aimedVolley_telegraph.png` | *"...**aimedVolley telegraph** — ports converging toward a target, golden aiming lines forming."* |
| `annihilator_aimedVolley_release.png` | *"...**aimedVolley release** — a converging fan of golden lances firing at a target."* |

### 6. Attack — `charge` (telegraph + release)

| File | Prompt |
|------|---------|
| `annihilator_charge_telegraph.png` | *"...**charge telegraph** — all thrusters igniting, bracing for a devastating ram."* |
| `annihilator_charge_release.png` | *"...**charge release** — mid-charge ram with a massive leading shockwave and motion streaks."* |

### 7. Attack — `summon` (telegraph + release)

| File | Prompt |
|------|---------|
| `annihilator_summon_telegraph.png` | *"...**summon telegraph** — reality tearing open around it, golden-red rifts forming."* |
| `annihilator_summon_release.png` | *"...**summon release** — elite minions pouring out of the open rifts."* |

### 8. Attack — `nova` (telegraph + release)

| File | Prompt |
|------|---------|
| `annihilator_nova_telegraph.png` | *"...**nova telegraph** — a colossal golden ring forming and expanding as a warning."* |
| `annihilator_nova_release.png` | *"...**nova release** — an arena-wide golden detonation bursting outward."* |

### 9. Attack — `shieldSlam` (telegraph + release)

| File | Prompt |
|------|---------|
| `annihilator_shieldSlam_telegraph.png` | *"...**shieldSlam telegraph** — raising up, gathering energy to re-forge its shield."* |
| `annihilator_shieldSlam_release.png` | *"...**shieldSlam release** — re-forging a blazing cyan shield dome with a radiant golden shockwave."* |

### 10. Enrage — phase 3 (1 prompt)

| File | Prompt |
|------|---------|
| `annihilator_enrage.png` | *"...**enraged phase-3 form** — armor glowing white-hot through the gold cracks, core overloaded and furious, every port venting energy, overwhelming aura."* |

### 11. Death sequence — 4 frames

| File | Prompt |
|------|---------|
| `annihilator_death_0.png` | *"...**death frame 1** — reeling, gold filigree cracking, core flaring erratically, energy venting from every port."* |
| `annihilator_death_1.png` | *"...**death frame 2** — armor blasting apart into indigo-and-gold pixel shards, core overloading red."* |
| `annihilator_death_2.png` | *"...**death frame 3** — a catastrophic gold-and-red explosion engulfing the body, core bursting."* |
| `annihilator_death_3.png` | *"...**death frame 4** — a final massive scatter of gold and red pixel debris fading out, body gone."* |

> **Total: 31 images** — 8 idle + 4 walk + barrage ×2 + spiral ×2 + aimedVolley ×2 + charge ×2 + summon ×2 + nova ×2 + shieldSlam ×2 + enrage + death ×4.

---

## Summary — image counts per boss

| Wave | Boss | id | Images |
|------|------|----|--------|
| 10 | The Warden | `warden` | 21 |
| 20 | The Juggernaut | `juggernaut` | 20 |
| 30 | The Hexweaver | `hexweaver` | 23 |
| 40 | The Bombardier | `bombardier` | 24 |
| 50 | The Phantom | `phantom` | 26 |
| 60 | The Overlord | `overlord` | 26 |
| 70 | The Tempest | `tempest` | 26 |
| 80 | The Colossus | `colossus` | 26 |
| 90 | The Voidcaller | `voidcaller` | 28 |
| 100 | The Annihilator | `annihilator` | 32 |
| | | **Total** | **252** |

> Counts include, for every boss: 8 idle directions + 4 move-cycle frames +
> 2 frames per power (telegraph + release) + 1 enrage + 4 death frames.
