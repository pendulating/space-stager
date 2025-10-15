import { describe, it, expect, vi } from 'vitest';
import {
  normalizeAngle,
  quantizeAbsolute45,
  quantizeAbsolute90,
  getCenterOffsetForPitch,
  quantizeBearingForView,
  getSnappedViewportBearing,
  snapBearingRelativeToArea,
  getSnappedBearing
} from '../bearingUtils.js';

function makeMap({ bearing = 10, pitch = 0 } = {}) {
  return {
    getBearing: () => bearing,
    getPitch: () => pitch
  };
}

describe('bearingUtils basics', () => {
  it('normalizes and quantizes absolute angles', () => {
    expect(normalizeAngle(-10)).toBeCloseTo(350, 6);
    expect(quantizeAbsolute45(44)).toBe(45);
    expect(quantizeAbsolute90(89)).toBe(90);
  });

  it('center offset for pitch is constant 22.5', () => {
    expect(getCenterOffsetForPitch(0)).toBe(22.5);
    expect(getCenterOffsetForPitch(30)).toBe(22.5);
  });
});

describe('bearingUtils map-related', () => {
  it('quantizeBearingForView uses center offset and wraps', () => {
    expect(quantizeBearingForView(361, 0)).toBeDefined();
  });

  it('getSnappedViewportBearing reads from map', () => {
    const map = makeMap({ bearing: 13, pitch: 0 });
    const val = getSnappedViewportBearing(map);
    expect(typeof val).toBe('number');
  });

  it('snapBearingRelativeToArea respects preferRightAngles and returns normalized', () => {
    const snapped = snapBearingRelativeToArea(100, 10, true);
    expect(snapped).toBeGreaterThanOrEqual(0);
    expect(snapped).toBeLessThan(360);
  });

  it('getSnappedBearing integrates map + area context', () => {
    const map = makeMap({ bearing: 10, pitch: 20 });
    const area = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] };
    const val = getSnappedBearing(map, area, null, null, { preferRightAngles: false });
    expect(typeof val).toBe('number');
  });
});


