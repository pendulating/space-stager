import { describe, it, expect } from 'vitest';
import { normalizeAngle, quantizeAbsolute45, quantizeAbsolute90, getSnappedViewportBearing, quantizeBearingForView, snapBearingRelativeToArea, snapCameraBearingToArea } from '../bearingUtils.js';

describe('bearingUtils', () => {
  it('normalizes and quantizes angles', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(-90)).toBe(270);
    expect(quantizeAbsolute45(44)).toBe(45);
    expect(quantizeAbsolute45(0)).toBe(0);
    expect(quantizeAbsolute90(89)).toBe(90);
  });

  it('quantizes viewport bearing with pitch center offset', () => {
    const map = { getPitch: () => 30, getBearing: () => 23 };
    const snapped = getSnappedViewportBearing(map);
    expect(typeof snapped).toBe('number');
    expect(snapped).toBeGreaterThanOrEqual(0);
    expect(snapped).toBeLessThan(360);
    const q = quantizeBearingForView(10, 0);
    expect(typeof q).toBe('number');
    expect(q).toBeGreaterThanOrEqual(0);
    expect(q).toBeLessThan(360);
  });

  it('snaps relative to area and returns absolute bearing', () => {
    // If camera 100, area 10, relative 90 => absolute 100
    const abs = snapBearingRelativeToArea(100, 10, true);
    expect(abs).toBeGreaterThanOrEqual(0);
    expect(abs).toBeLessThan(360);

    const snapped = snapCameraBearingToArea(95, { map: { getPitch: () => 0 }, areaGeom: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] }, pitch: 0, enforceAbsolute45: true });
    expect(snapped).toBeGreaterThanOrEqual(0);
    expect(snapped).toBeLessThan(360);
  });
});


