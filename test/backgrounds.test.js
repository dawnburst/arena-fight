import { describe, expect, it } from 'vitest';
import {
  ARENA_BACKGROUNDS,
  backgroundKey,
  backgroundPath,
  resolveBackground,
} from '../src/backgrounds.js';

describe('backgrounds', () => {
  it('should have backgrounds defined', () => {
    expect(ARENA_BACKGROUNDS.length).toBeGreaterThan(0);
  });

  it('backgroundKey should return expected key', () => {
    expect(backgroundKey('meadow')).toBe('arena-background-meadow');
  });

  it('backgroundPath should return expected path', () => {
    const bg = ARENA_BACKGROUNDS[0];
    expect(backgroundPath(bg)).toContain(bg.file);
  });

  it('resolveBackground should return background by id', () => {
    const bg = ARENA_BACKGROUNDS[1];
    expect(resolveBackground(bg.id)).toEqual(bg);
  });

  it('resolveBackground should return default background if id not found', () => {
    expect(resolveBackground('non-existent')).toEqual(ARENA_BACKGROUNDS[0]);
  });

  it('resolveBackground should return default background if no id provided', () => {
    expect(resolveBackground()).toEqual(ARENA_BACKGROUNDS[0]);
  });
});
