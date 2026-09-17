import { describe, expect, it } from 'vitest';
import { contrastRatio, meetsAA, parseHex, relativeLuminance, surfacesSeparated } from '../src/design/contrast';

describe('contrast', () => {
  it('computes the known extremes', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 6);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#123456', '#abcdef')).toBeCloseTo(contrastRatio('#abcdef', '#123456'), 9);
  });

  it('accepts shorthand hex', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(relativeLuminance('#000')).toBeCloseTo(0, 9);
  });

  it('rejects nonsense instead of silently returning black', () => {
    expect(() => parseHex('not-a-colour')).toThrow();
  });

  it('flags the reference app’s card-on-page surfaces as too close', () => {
    // #2d2d2d on #222222 — visible in a screenshot, invisible on a phone in daylight.
    expect(surfacesSeparated('#2d2d2d', '#222222')).toBe(false);
  });

  it('accepts a properly separated pair of dark surfaces', () => {
    expect(surfacesSeparated('#343434', '#1c1c1c')).toBe(true);
  });

  it('checks body text against AA', () => {
    expect(meetsAA('#ffffff', '#1c1c1c')).toBe(true);
    expect(meetsAA('#8a8a8a', '#7a7a7a')).toBe(false);
  });
});
