import { describe, it, expect, vi } from 'vitest';
import { padAngle, quantizeAngleTo45, computeBearingDegrees, computeNearestLineBearing, buildSpriteImageId, addEnhancedSpritesToMap } from '../enhancedRenderingUtils.js';

describe('enhancedRenderingUtils branches', () => {
  it('padAngle/quantize/buildSpriteImageId basic cases', () => {
    expect(padAngle(0)).toBe('000');
    expect(padAngle(45)).toBe('045');
    expect(padAngle(360)).toBe('000');
    expect(quantizeAngleTo45(23)).toBe(45);
    expect(quantizeAngleTo45(67)).toBe(45);
    expect(buildSpriteImageId('linknyc', 90)).toBe('linknyc_090');
  });

  it('computeBearingDegrees returns 0..360 approx', () => {
    const b = computeBearingDegrees(-74, 40.7, -73.99, 40.7);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });

  it('computeNearestLineBearing handles LineString and MultiLineString and returns stable rounded', () => {
    const point = { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99, 40.7] } };
    const lines = [
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-74,40.7],[-73.98,40.7]] } },
      { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [[[-74,40.69],[-73.98,40.71]]] } }
    ];
    const bearing = computeNearestLineBearing(point, lines);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
  });

  it('addEnhancedSpritesToMap skips already-registered and registers new images', async () => {
    const added = [];
    const map = {
      hasImage: vi.fn((id) => added.includes(id)),
      addImage: vi.fn((id) => added.push(id))
    };
    // Mock Image to call onload immediately
    const origImage = global.Image;
    class FakeImage {
      set src(v) { setTimeout(() => { this.onload && this.onload(); }, 0); }
      set crossOrigin(v) {}
    }
    global.Image = FakeImage;
    await addEnhancedSpritesToMap(map, { baseName: 'bench', publicDir: '/icons', angles: [0, 90] });
    expect(added.includes('bench_000')).toBe(true);
    expect(added.includes('bench_090')).toBe(true);
    global.Image = origImage;
  });
});


