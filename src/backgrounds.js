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
