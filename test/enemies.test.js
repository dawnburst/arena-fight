import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BOSS_SPRITES,
  ENEMY_BESTIARY,
  ENEMY_SPRITES,
  RUNE_PROWLER_SPRITES,
} from '../src/enemies.js';

describe('enemies', () => {
  it('should have enemy sprites and bestiary', () => {
    expect(Object.keys(ENEMY_SPRITES).length).toBeGreaterThan(0);
    expect(ENEMY_BESTIARY.length).toBeGreaterThan(0);
  });

  it('registers every completed boss frame to an existing asset', () => {
    const expectedFrameCounts = {
      warden: 21,
      juggernaut: 21,
      hexweaver: 23,
      bombardier: 23,
      overlord: 25,
    };
    for (const [id, expectedCount] of Object.entries(expectedFrameCounts)) {
      const frames = BOSS_SPRITES[id];
      expect(Object.keys(frames), id).toHaveLength(expectedCount);
      for (const frame of Object.values(frames)) {
        expect(existsSync(join(process.cwd(), 'public', frame.path)), frame.path).toBe(true);
      }
    }
  });

  it('registers every Rune Prowler direction to an existing asset', () => {
    expect(Object.keys(RUNE_PROWLER_SPRITES)).toHaveLength(8);
    for (const frame of Object.values(RUNE_PROWLER_SPRITES)) {
      expect(existsSync(join(process.cwd(), 'public', frame.path))).toBe(true);
    }
  });
});
