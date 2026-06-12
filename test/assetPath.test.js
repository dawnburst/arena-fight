import { describe, expect, it } from 'vitest';
import { assetPath } from '../src/assetPath.js';

describe('assetPath', () => {
  it('should prepend BASE_URL to path starting with slash', () => {
    expect(assetPath('/assets/test.png')).toBe('/assets/test.png');
  });

  it('should prepend BASE_URL to path NOT starting with slash', () => {
    expect(assetPath('assets/test.png')).toBe('/assets/test.png');
  });
});
