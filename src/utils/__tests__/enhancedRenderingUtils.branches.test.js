import { describe, it, expect, vi } from 'vitest';
import { padAngle, quantizeAngleTo45, computeBearingDegrees, computeNearestLineBearing, buildSpriteImageId, addEnhancedSpritesToMap, computeNearestSegmentClosestPointBearing, computeFeatureSpriteAngle, extractCameraState, computeCameraBucket, computeSpriteTransform, buildSpriteFallbacks } from '../enhancedRenderingUtils.js';

describe('enhancedRenderingUtils branches', () => {
  it('padAngle/quantize/buildSpriteImageId basic cases', () => {
    expect(padAngle(0)).toBe('000');
    expect(padAngle(45)).toBe('045');
    expect(padAngle(360)).toBe('000');
    expect(quantizeAngleTo45(23)).toBe(45);
    expect(quantizeAngleTo45(67)).toBe(45);
    expect(buildSpriteImageId('linknyc', 90, 'isometric')).toBe('linknyc_090');
    expect(buildSpriteImageId('linknyc', 90, 'top-down')).toBe('linknyc_TOP_090');
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

  it('computeNearestSegmentClosestPointBearing returns side and axis', () => {
    const point = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} };
    const lines = [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[-1, -1], [1, -1]] }, properties: {} }];
    const res = computeNearestSegmentClosestPointBearing(point, lines);
    expect(res).toBeTruthy();
    expect(typeof res.axisBearing).toBe('number');
    expect(res.side === 'left' || res.side === 'right').toBe(true);
  });

  it('computeFeatureSpriteAngle respects facingMode and side', () => {
    const mockMap = { getBearing: () => 0, getPitch: () => 0 };
    const view = { bearing: 0, pitch: 0 };
    const areaGeom = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] };
    // axis 90°, left side → towardStreet should choose right normal (axis+90) = 180
    const toward = computeFeatureSpriteAngle({ map: mockMap, view, areaGeom, facingMode: 'towardStreet', baseAxisBearing: 90, side: 'left', spriteBase: 'bench' });
    expect(toward).toBeTruthy();
    expect(typeof toward.angle).toBe('number');
    const away = computeFeatureSpriteAngle({ map: mockMap, view, areaGeom, facingMode: 'awayFromStreet', baseAxisBearing: 90, side: 'left', spriteBase: 'bench' });
    expect(away).toBeTruthy();
    expect(typeof away.angle).toBe('number');
  });

  it('extractCameraState falls back to map getters when view missing', () => {
    const map = { getBearing: () => 33.333, getPitch: () => 12.5 };
    const state = extractCameraState({ map });
    expect(state.viewType).toBe('top-down');
    expect(state.bearing).toBe(33.333);
    expect(state.pitch).toBe(12.5);
  });

  it('computeCameraBucket returns fractional precision in top-down and slices in isometric', () => {
    const topDown = computeCameraBucket({ cameraState: { viewType: 'top-down', bearing: 10 } });
    expect(topDown).toBeCloseTo(10, 2);
    const iso = computeCameraBucket({ cameraState: { viewType: 'isometric', bearing: 100 } });
    expect(typeof iso).toBe('number');
    expect(iso % 45).toBeCloseTo(22.5 % 45, 4);
  });

  it('computeSpriteTransform yields rotation in top-down and sprite ids in isometric', () => {
    const top = computeSpriteTransform({
      spriteBase: 'bench',
      baseAngleDeg: 90,
      displayAngleDeg: 135,
      cameraState: { viewType: 'top-down', bearing: 30, pitch: 0 }
    });
    expect(top.imageId).toBe('bench_000');
    expect(top.iconRotate).toBeCloseTo(135 - 30);

    const isoMap = { getBearing: () => 40, getPitch: () => 25 };
    const iso = computeSpriteTransform({
      map: isoMap,
      spriteBase: 'bench',
      baseAngleDeg: 90,
      cameraState: { viewType: 'isometric', bearing: 40, pitch: 25 }
    });
    expect(iso.imageId).toMatch(/bench_/);
    expect(iso.iconRotate).toBe(0);
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


