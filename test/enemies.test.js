import { describe, expect, it } from 'vitest';
import { ENEMY_BESTIARY, ENEMY_SPRITES } from '../src/enemies.js';

describe('enemies', () => {
  it('should have enemy sprites and bestiary', () => {
    expect(Object.keys(ENEMY_SPRITES).length).toBeGreaterThan(0);
    expect(ENEMY_BESTIARY.length).toBeGreaterThan(0);
  });
});
