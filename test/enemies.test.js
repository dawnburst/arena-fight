import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOSS_SPRITES, ENEMY_BESTIARY, ENEMY_SPRITES } from '../src/enemies.js';

describe('enemies', () => {
  it('should have enemy sprites and bestiary', () => {
    expect(Object.keys(ENEMY_SPRITES).length).toBeGreaterThan(0);
    expect(ENEMY_BESTIARY.length).toBeGreaterThan(0);
  });

  it('registers every Juggernaut frame to an existing asset', () => {
    const frames = BOSS_SPRITES.juggernaut;
    expect(Object.keys(frames)).toHaveLength(21);
    for (const frame of Object.values(frames)) {
      expect(existsSync(join(process.cwd(), 'public', frame.path))).toBe(true);
    }
  });
});
