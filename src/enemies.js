import { assetPath } from './assetPath.js';

export const ENEMY_SPRITES = {
  warden: {
    key: 'boss-warden-idle-s',
    path: assetPath('assets/enemies/boss/warden/warden_idle_s.png'),
    frameWidth: 256,
    frameHeight: 256,
    frames: 1,
  },
  juggernaut: {
    key: 'boss-juggernaut-idle-s',
    path: assetPath('assets/enemies/boss/juggernaut/juggernaut_idle_s.png'),
    frameWidth: 256,
    frameHeight: 256,
    frames: 1,
  },
  hexweaver: {
    key: 'boss-hexweaver-idle-s',
    path: assetPath('assets/enemies/boss/hexweaver/hexweaver_idle_s.png'),
    frameWidth: 256,
    frameHeight: 256,
    frames: 1,
  },
  bombardier: {
    key: 'boss-bombardier-idle-s',
    path: assetPath('assets/enemies/boss/bombardier/bombardier_idle_s.png'),
    frameWidth: 256,
    frameHeight: 256,
    frames: 1,
  },
  phantom: {
    key: 'boss-phantom-idle-s',
    path: assetPath('assets/enemies/boss/phantom/phantom_idle_s.png'),
    frameWidth: 256,
    frameHeight: 256,
    frames: 1,
  },
  overlord: {
    key: 'boss-overlord-idle-s',
    path: assetPath('assets/enemies/boss/overlord/overlord_idle_s.png'),
    frameWidth: 256,
    frameHeight: 256,
    frames: 1,
  },
  tempest: {
    key: 'boss-tempest-idle-s',
    path: assetPath('assets/enemies/boss/tempest/tempest_idle_s.png'),
    frameWidth: 256,
    frameHeight: 256,
    frames: 1,
  },
  monster: {
    key: 'enemy-monster-walk',
    path: assetPath('assets/enemies/monster/walk.png'),
    frameWidth: 64,
    frameHeight: 64,
  },
  firecaster: {
    key: 'enemy-firecaster-walk',
    path: assetPath('assets/enemies/firecaster/walk.png'),
    frameWidth: 64,
    frameHeight: 64,
  },
  tank: {
    key: 'enemy-tank-walk',
    path: assetPath('assets/enemies/tank/walk.png'),
    frameWidth: 64,
    frameHeight: 64,
  },
  splitter: {
    key: 'enemy-splitter-walk',
    path: assetPath('assets/enemies/splitter/walk.png'),
    frameWidth: 64,
    frameHeight: 64,
  },
  bomber: {
    key: 'enemy-bomber-walk',
    path: assetPath('assets/enemies/bomber/walk.png'),
    frameWidth: 64,
    frameHeight: 64,
  },
  healer: {
    key: 'enemy-healer-walk',
    path: assetPath('assets/enemies/healer/walk.png'),
    frameWidth: 64,
    frameHeight: 64,
  },
  summoner: {
    key: 'enemy-summoner-walk',
    path: assetPath('assets/enemies/summoner/walk.png'),
    frameWidth: 64,
    frameHeight: 64,
  },
  shielded: {
    key: 'enemy-shielded-walk',
    path: assetPath('assets/enemies/shielded/walk.png'),
    frameWidth: 64,
    frameHeight: 64,
  },
  teleporter: {
    key: 'enemy-teleporter-walk',
    path: assetPath('assets/enemies/teleporter/walk.png'),
    frameWidth: 64,
    frameHeight: 64,
  },
  sniper: {
    key: 'enemy-sniper-walk',
    path: assetPath('assets/enemies/sniper/walk.png'),
    frameWidth: 64,
    frameHeight: 64,
  },
  egg: {
    key: 'enemy-egg-walk',
    path: assetPath('assets/enemies/egg/walk.png'),
    frameWidth: 64,
    frameHeight: 64,
  },
  slime: {
    key: 'enemy-slime-walk',
    path: assetPath('assets/enemies/slime/walk.png'),
    frameWidth: 64,
    frameHeight: 64,
  },
};

const bossFrame = (id, name) => ({
  key: `boss-${id}-${name.replaceAll('_', '-')}`,
  path: assetPath(`assets/enemies/boss/${id}/${id}_${name}.png`),
});

const bossFrames = (id, powers) => ({
  idle_s: ENEMY_SPRITES[id],
  ...Object.fromEntries(
    ['idle_n', 'idle_w', 'idle_e', 'idle_se', 'idle_sw', 'idle_ne', 'idle_nw'].map((name) => [
      name,
      bossFrame(id, name),
    ]),
  ),
  ...Object.fromEntries(
    Array.from({ length: 4 }, (_, index) => `walk_s_${index}`).map((name) => [
      name,
      bossFrame(id, name),
    ]),
  ),
  ...Object.fromEntries(
    powers.flatMap((power) =>
      ['telegraph', 'release'].map((state) => {
        const name = `${power}_${state}`;
        return [name, bossFrame(id, name)];
      }),
    ),
  ),
  enrage: bossFrame(id, 'enrage'),
  ...Object.fromEntries(
    Array.from({ length: 4 }, (_, index) => `death_${index}`).map((name) => [
      name,
      bossFrame(id, name),
    ]),
  ),
});

export const BOSS_SPRITES = {
  warden: bossFrames('warden', ['summon', 'barrage']),
  juggernaut: bossFrames('juggernaut', ['barrage', 'charge']),
  hexweaver: bossFrames('hexweaver', ['beamSweep', 'mirrorClones', 'gravityWell']),
  bombardier: bossFrames('bombardier', ['aimedVolley', 'barrage', 'charge']),
  phantom: bossFrames('phantom', ['barrage', 'nova', 'charge', 'dotField']),
  overlord: bossFrames('overlord', ['missiles', 'barrage', 'charge', 'nova']),
  tempest: bossFrames('tempest', ['spiral', 'aimedVolley', 'charge', 'nova']),
};

const runeProwlerFrame = (direction) => ({
  key: `enemy-rune-prowler-idle-${direction}`,
  path: assetPath(`assets/enemies/boss/hexweaver/rune-prowler/rune_prowler_idle_${direction}.png`),
});

export const RUNE_PROWLER_SPRITES = Object.fromEntries(
  ['s', 'n', 'w', 'e', 'se', 'sw', 'ne', 'nw'].map((direction) => [
    direction,
    runeProwlerFrame(direction),
  ]),
);

export const ENEMY_BESTIARY = [
  {
    id: 'swarmer',
    name: 'Swarmer',
    sprite: 'monster',
    frame: 0,
    tint: null,
    firstWave: 'Wave 1',
    movement: 'Moves directly toward the player from the arena edges.',
    power: 'No special attack. It wins by surrounding you and forcing movement mistakes.',
    counter: 'Keep moving, shoot while backing up, and clear groups before they close in.',
  },
  {
    id: 'tank',
    name: 'Tank',
    sprite: 'tank',
    frame: 0,
    tint: null,
    firstWave: 'Wave 10',
    movement: 'Moves slowly and directly toward the player.',
    power: 'High health. It absorbs shots while smaller enemies pressure you.',
    counter: 'Kite it around the arena and clear weaker enemies before focusing it down.',
  },
  {
    id: 'firecaster',
    name: 'Firecaster',
    sprite: 'firecaster',
    frame: 2,
    tint: null,
    firstWave: 'Wave 15',
    movement: 'Keeps distance, backs away when too close, and strafes while aiming.',
    power: 'Charges briefly, then shoots a fireball at your position.',
    counter: 'Watch for the orange flash, then dodge sideways before the shot releases.',
  },
  {
    id: 'splitter',
    name: 'Splitter',
    sprite: 'splitter',
    frame: 1,
    tint: null,
    firstWave: 'Wave 20',
    movement: 'Chases at medium speed.',
    power: 'Splits into three small fast enemies when killed.',
    counter: 'Create space before finishing it so the smaller enemies do not surround you.',
  },
  {
    id: 'bomber',
    name: 'Bomber',
    sprite: 'bomber',
    frame: 2,
    tint: null,
    firstWave: 'Wave 25',
    movement: 'Runs aggressively toward the player.',
    power: 'Flashes and explodes when close or when killed.',
    counter: 'Shoot it early and move away when it starts flashing.',
  },
  {
    id: 'egg',
    name: 'Spawner Egg',
    sprite: 'egg',
    frame: 0,
    tint: null,
    firstWave: 'Wave 35',
    movement: 'Stationary.',
    power: 'Periodically hatches small enemies until destroyed.',
    counter: 'Destroy it early so it cannot multiply the wave.',
  },
  {
    id: 'slime',
    name: 'Poison Slime',
    sprite: 'slime',
    frame: 1,
    tint: null,
    firstWave: 'Wave 40',
    movement: 'Slowly follows the player.',
    power: 'Leaves damaging poison puddles on the ground.',
    counter: 'Avoid its trail and fight it in open space.',
  },
  {
    id: 'healer',
    name: 'Healer',
    sprite: 'healer',
    frame: 0,
    tint: null,
    firstWave: 'Wave 45',
    movement: 'Stays behind the pack and avoids getting too close.',
    power: 'Periodically heals nearby enemies.',
    counter: 'Prioritize it before fighting tanks or shielded enemies.',
  },
  {
    id: 'summoner',
    name: 'Summoner',
    sprite: 'summoner',
    frame: 3,
    tint: null,
    firstWave: 'Wave 50',
    movement: 'Keeps distance and drifts away when pressured.',
    power: 'Summons weak minions over time.',
    counter: 'Push through the crowd and eliminate it before the wave grows.',
  },
  {
    id: 'dasher',
    name: 'Dasher',
    sprite: 'monster',
    frame: 1,
    tint: 0x2e7d32,
    firstWave: 'Wave 55',
    movement: 'Walks slowly, stops for a short windup, then launches into a fast dash.',
    power: 'The dash covers distance quickly after a flashing warning.',
    counter: 'When it flashes, sidestep instead of running straight away.',
  },
  {
    id: 'shielded',
    name: 'Shielded',
    sprite: 'shielded',
    frame: 0,
    tint: null,
    firstWave: 'Wave 65',
    movement: 'Faces and advances toward the player.',
    power: 'Takes reduced damage from the front.',
    counter: 'Circle around it, use spread fire, or hit it with explosions.',
  },
  {
    id: 'teleporter',
    name: 'Teleporter',
    sprite: 'teleporter',
    frame: 1,
    tint: null,
    firstWave: 'Wave 70',
    movement: 'Moves normally, then blinks near the player after a warning.',
    power: 'Teleport pressure can cut off your escape path.',
    counter: 'When it flashes purple, change direction and prepare to dash.',
  },
  {
    id: 'sniper',
    name: 'Sniper',
    sprite: 'sniper',
    frame: 2,
    tint: null,
    firstWave: 'Wave 75',
    movement: 'Maintains long range and stops to aim.',
    power: 'Draws a warning line, then fires a fast shot.',
    counter: 'Watch the line and dodge sideways before the shot releases.',
  },
  {
    id: 'boss',
    name: 'The Warden',
    sprite: 'warden',
    frame: 0,
    tint: null,
    galleryScale: 0.27,
    detailScale: 0.78,
    firstWave: 'Wave 10',
    movement:
      'Hovers near the top, tracking you and summoning minions. A different boss appears each boss wave (Wave 10 up to Wave 100), tougher the deeper you go.',
    power:
      'A regenerating shield blocks body hits; small orbiting weak points take extra damage. Three phases mix radial barrages, spiraling fire, charges, slams, and area blasts.',
    counter:
      'Snipe the moving weak points or break the shield, then unload. Dodge the charge windup and stay clear of slams.',
  },
  {
    id: 'boss-juggernaut',
    name: 'The Juggernaut',
    sprite: 'juggernaut',
    frame: 0,
    tint: null,
    galleryScale: 0.27,
    detailScale: 0.78,
    firstWave: 'Wave 20',
    movement: 'Tracks you near the top, then launches a heavy horn-first charge.',
    power:
      'A shield and orbiting weak points guard three phases while lime radial barrages and telegraphed charges pressure the arena.',
    counter:
      'Hit the orbiting weak points, sidestep the lowered-horn charge, and move through gaps in each barrage.',
  },
  {
    id: 'boss-hexweaver',
    name: 'The Hexweaver',
    sprite: 'hexweaver',
    frame: 0,
    tint: null,
    galleryScale: 0.27,
    detailScale: 0.78,
    firstWave: 'Wave 30',
    movement:
      'Floats near the top, tracking you while shielded rune nodes orbit through three phases.',
    power:
      'Sweeps arcane beams, spawns projectile-firing mirror clones, then pulls the arena into a damaging gravity well.',
    counter:
      'Break the shield via the orbiting weak points, move with the beam gaps, kill clones fast, and fight the gravity pull.',
  },
  {
    id: 'boss-bombardier',
    name: 'The Bombardier',
    sprite: 'bombardier',
    frame: 0,
    tint: null,
    galleryScale: 0.27,
    detailScale: 0.78,
    firstWave: 'Wave 40',
    movement: 'Tracks you from the top, then braces for a thruster-powered charge.',
    power:
      'Three phases add aimed orange shell volleys, full-circle barrages, and a telegraphed ram behind a regenerating shield.',
    counter:
      'Cross the aim lines, weave between radial shots, then sidestep the charge while hitting its weak points.',
  },
  {
    id: 'boss-phantom',
    name: 'The Phantom',
    sprite: 'phantom',
    frame: 0,
    tint: null,
    galleryScale: 0.27,
    detailScale: 0.78,
    firstWave: 'Wave 50',
    movement: 'Drifts near the top with a spectral body and three orbiting weak points.',
    power:
      'Mixes radial barrages and nova blasts, then adds a forward charge and phase-3 red-dot fields that punish standing still.',
    counter:
      'Track the weak points, move through barrage gaps, leave room for the nova, and sidestep the charge.',
  },
  {
    id: 'boss-overlord',
    name: 'The Overlord',
    sprite: 'overlord',
    frame: 0,
    tint: null,
    galleryScale: 0.27,
    detailScale: 0.78,
    firstWave: 'Wave 60',
    movement: 'Tracks you from the top, mixing heavy braced attacks with a forward charge.',
    power:
      'Launches homing missiles, fires radial barrages, rams in a telegraphed charge, and overcharges into a nova in the final phase.',
    counter:
      'Shoot down missiles, move through barrage gaps, sidestep the charge, and stay outside the nova warning.',
  },
  {
    id: 'boss-tempest',
    name: 'The Tempest',
    sprite: 'tempest',
    frame: 0,
    tint: null,
    galleryScale: 0.27,
    detailScale: 0.78,
    firstWave: 'Wave 70',
    movement: 'Tracks you from the top as a storm-armored cyclone body with four weak points.',
    power:
      'Layers spiral shot patterns, aimed cyan volleys, a telegraphed charge, and a final-phase nova behind a regenerating shield.',
    counter:
      'Keep moving through spiral gaps, cross the aimed fan before it releases, and sidestep the charge before punishing the weak points.',
  },
];
