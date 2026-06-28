// Character skins. A skin is a full alternate set of the 48 player body frames
// (8 directions × 6 poses) plus a store/owned/equipped record. It reuses the
// existing player sprite + store + save machinery.
//
// Asset state: every skin now ships a full set of frames under
// `public/assets/player/skins/<id>/<dir>-<pose>.png`, so each skin is marked
// `assetsReady: true` and the game loads and uses those frames (falling back to
// the default frame for any pose whose art is missing). The `tint` colour is
// retained only as the legacy placeholder look for any future skin added before
// its art lands (set that skin's `assetsReady` to `false` until then).
//
// See `plan_docs/skin-image-prompts.md` for the per-skin generation prompts,
// target paths, and image sizes.

import { TIER_COLORS } from './catalog.js';

export const DEFAULT_SKIN_ID = 'default';

// Skins, ordered however; the store sorts them ascending by price. `tier` is
// only used for the existing TIER_COLORS styling. `tint` drives the placeholder
// look while `assetsReady` is false. The default skin keeps the original art
// (no tint) and is free + always owned.
export const SKINS = [
  {
    id: 'default',
    name: 'Recruit',
    tier: 'common',
    price: 0,
    description: 'The classic look. Always yours.',
    tint: null,
    assetsReady: true,
  },
  {
    id: 'ninja',
    name: 'Ninja',
    tier: 'common',
    price: 600,
    description: 'Silent and sharp — black-clad with a red scarf.',
    tint: 0x5a6172,
    assetsReady: true,
  },
  {
    id: 'girl',
    name: 'Ranger',
    tier: 'common',
    price: 900,
    description: 'Confident ranger in a green tactical outfit.',
    tint: 0x66bb6a,
    assetsReady: true,
  },
  {
    id: 'panda',
    name: 'Panda',
    tier: 'uncommon',
    price: 1500,
    description: 'Adorably dangerous black-and-white warrior.',
    tint: 0xd6d6d6,
    assetsReady: true,
  },
  {
    id: 'robot',
    name: 'Mech',
    tier: 'rare',
    price: 2500,
    description: 'Chrome and circuits with glowing blue accents.',
    tint: 0x90caf9,
    assetsReady: true,
  },
  {
    id: 'knight',
    name: 'Knight',
    tier: 'rare',
    price: 4000,
    description: 'Silver-armored knight with a plumed helmet.',
    tint: 0xb0bec5,
    assetsReady: true,
  },
  {
    id: 'pirate',
    name: 'Pirate',
    tier: 'epic',
    price: 6000,
    description: 'Swashbuckler in a tricorn hat and red coat.',
    tint: 0xe57373,
    assetsReady: true,
  },
  {
    id: 'astronaut',
    name: 'Astronaut',
    tier: 'legendary',
    price: 9000,
    description: 'White spacesuit with a reflective visor.',
    tint: 0xeceff1,
    assetsReady: true,
  },
];

const BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));
export const SKINS_BY_ID = BY_ID;

export function getSkin(id) {
  return SKINS_BY_ID[id] || SKINS_BY_ID[DEFAULT_SKIN_ID];
}

// Skins sorted cheapest → most expensive, for the store list (user requirement).
export function skinsByPrice() {
  return [...SKINS].sort((a, b) => a.price - b.price);
}

// Hex colour string for a skin's tier (reuses the shared TIER_COLORS palette).
export function skinTierColor(skin) {
  return TIER_COLORS[skin?.tier] || TIER_COLORS.common;
}

// Shared store/loadout thumbnail descriptor for a skin. Skins with shipped art
// use their own south-idle frame; the default skin and any not-yet-arted skin
// reuse the base body frame (recoloured with `tint` as a placeholder).
export const SKIN_THUMB_BASE_KEY = 'skin-thumb-base';
const SKIN_THUMB_BASE_PATH = 'assets/player/body/south-idle.png';

export function skinThumb(skin) {
  const hasArt = skin?.assetsReady && skin.id !== DEFAULT_SKIN_ID;
  return {
    key: hasArt ? `skin-thumb-${skin.id}` : SKIN_THUMB_BASE_KEY,
    path: hasArt ? `assets/player/skins/${skin.id}/south-idle.png` : SKIN_THUMB_BASE_PATH,
    // Tint only the placeholder (base-frame) thumbnails; real art renders as-is.
    tint: hasArt ? null : (skin?.tint ?? null),
  };
}
