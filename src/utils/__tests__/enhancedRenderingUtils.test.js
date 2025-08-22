import { describe, it, expect } from 'vitest';
import { padAngle, quantizeAngleTo45, computeBearingDegrees, buildSpriteImageId } from '../enhancedRenderingUtils.js';

describe('enhancedRenderingUtils', () => {
  it('padAngle pads and wraps correctly', () => {
    expect(padAngle(0)).toBe('000');
    expect(padAngle(45)).toBe('045');
    expect(padAngle(360)).toBe('000');
    expect(padAngle(-45)).toBe('315');
  });

  it('quantizeAngleTo45 buckets angles', () => {
    expect(quantizeAngleTo45(10)).toBe(0);
    expect(quantizeAngleTo45(23)).toBe(45);
    expect(quantizeAngleTo45(181)).toBe(180);
    expect(quantizeAngleTo45(-10)).toBe(0);
  });

  it('computeBearingDegrees returns 0..360', () => {
    const b1 = computeBearingDegrees(-74, 40.7, -73.99, 40.71);
    expect(b1).toBeGreaterThanOrEqual(0);
    expect(b1).toBeLessThan(360);
  });

  it('buildSpriteImageId formats id', () => {
    expect(buildSpriteImageId('linknyc', 90)).toBe('linknyc_090');
  });
});


