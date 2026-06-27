import { assetPath } from './assetPath.js';

export const ARENA_BACKGROUNDS = [
  {
    id: 'meadow',
    name: 'Meadow',
    description: 'Bright grass, flowers, rocks, and light worn paths.',
    file: 'meadow.png',
  },
  {
    id: 'training-field',
    name: 'Training Field',
    description: 'Scuffed grass, dirt lanes, stones, and broken field posts.',
    file: 'training-field.png',
  },
  {
    id: 'moss-ruins',
    name: 'Moss Ruins',
    description: 'Darker moss, cracked stone patches, vines, and old tiles.',
    file: 'moss-ruins.png',
  },
];

// Boss-wave-only background. Kept out of ARENA_BACKGROUNDS so it never appears
// in the Settings background picker; GameScene swaps to it on boss waves and
// reverts to the player's selected background afterwards.
export const BOSS_BACKGROUND = {
  id: 'hell-arena',
  name: 'Hell Arena',
  description: 'Scorched obsidian ground, lava cracks, embers, red glow.',
  file: 'hell-arena.png',
};

export const DEFAULT_BACKGROUND_ID = ARENA_BACKGROUNDS[0].id;

export const BACKGROUNDS_BY_ID = Object.fromEntries(
  ARENA_BACKGROUNDS.map((background) => [background.id, background]),
);

export function backgroundKey(id) {
  return `arena-background-${id}`;
}

export function backgroundPath(background) {
  return assetPath(`assets/backgrounds/${background.file}`);
}

export function resolveBackground(id) {
  return BACKGROUNDS_BY_ID[id] || BACKGROUNDS_BY_ID[DEFAULT_BACKGROUND_ID];
}
