import { describe, it, expect } from 'vitest';
import { CFG } from '../src/config.js';

describe('config', () => {
  it('should be a valid config object', () => {
    expect(CFG).toBeDefined();
    expect(CFG.arena.width).toBe(800);
    expect(CFG.arena.height).toBe(600);
  });
});
