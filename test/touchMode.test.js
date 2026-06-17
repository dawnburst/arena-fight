import { beforeEach, describe, expect, it } from 'vitest';
import { resolveTouchMode, touchActive } from '../src/input/touchMode.js';
import { Save } from '../src/save.js';

describe('resolveTouchMode', () => {
  it("'on' forces touch on regardless of pointer", () => {
    expect(resolveTouchMode('on', false)).toBe(true);
    expect(resolveTouchMode('on', true)).toBe(true);
  });

  it("'off' forces touch off regardless of pointer", () => {
    expect(resolveTouchMode('off', false)).toBe(false);
    expect(resolveTouchMode('off', true)).toBe(false);
  });

  it("'auto' follows the coarse-pointer detection", () => {
    expect(resolveTouchMode('auto', true)).toBe(true);
    expect(resolveTouchMode('auto', false)).toBe(false);
  });

  it('undefined override defaults to auto behaviour', () => {
    expect(resolveTouchMode(undefined, true)).toBe(true);
    expect(resolveTouchMode(undefined, false)).toBe(false);
  });
});

describe('touchActive', () => {
  beforeEach(() => {
    localStorage.clear();
    Save._clearCache();
  });

  it("reads the persisted override ('on' enables without a touchscreen)", () => {
    Save.setTouchControls('on');
    expect(touchActive()).toBe(true);
  });

  it("'off' disables touch in the save", () => {
    Save.setTouchControls('off');
    expect(touchActive()).toBe(false);
  });

  it("defaults to 'auto' (no coarse pointer under jsdom => false)", () => {
    expect(Save.get().settings.touchControls).toBe('auto');
    expect(touchActive()).toBe(false);
  });
});
