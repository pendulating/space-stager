import { describe, it, expect } from 'vitest';
import { hexToRgb, rgbaString } from '../colorUtils.js';

describe('colorUtils', () => {
  it('hexToRgb parses 6-digit hex', () => {
    expect(hexToRgb('#112233')).toEqual({ r: 17, g: 34, b: 51 });
    expect(hexToRgb('112233')).toEqual({ r: 17, g: 34, b: 51 });
  });

  it('hexToRgb parses 3-digit hex', () => {
    expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });
  });

  it('hexToRgb returns null on invalid', () => {
    expect(hexToRgb('#12')).toBeNull();
    expect(hexToRgb('#zzzzzz')).toBeNull();
    expect(hexToRgb(null)).toBeNull();
  });

  it('rgbaString clamps alpha and formats', () => {
    expect(rgbaString({ r: 1, g: 2, b: 3 }, 0.5)).toBe('rgba(1, 2, 3, 0.5)');
    expect(rgbaString({ r: 1, g: 2, b: 3 }, -1)).toBe('rgba(1, 2, 3, 0)');
    expect(rgbaString({ r: 1, g: 2, b: 3 }, 2)).toBe('rgba(1, 2, 3, 1)');
  });
});


