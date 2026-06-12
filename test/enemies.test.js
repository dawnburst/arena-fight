import { describe, it, expect } from 'vitest';
import { ENEMY_SPRITES, ENEMY_BESTIARY } from '../src/enemies.js';

describe('enemies', () => {
  it('should have enemy sprites and bestiary', () => {
    expect(Object.keys(ENEMY_SPRITES).length).toBeGreaterThan(0);
    expect(ENEMY_BESTIARY.length).toBeGreaterThan(0);
  });
});
