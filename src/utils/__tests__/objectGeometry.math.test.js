import { describe, it, expect, vi } from 'vitest';
import { normalizeAngle, rotateRectanglePolygon, rotateRectanglePolygonScreen } from '../objectGeometry.js';

function makeMapMock() {
  return {
    project: vi.fn(([lng, lat]) => ({ x: lng * 10, y: -lat * 10 })),
    unproject: vi.fn(([x, y]) => ({ lng: x / 10, lat: -y / 10 }))
  };
}

describe('objectGeometry utilities', () => {
  it('normalizeAngle wraps to [0,360)', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(725)).toBe(5);
  });

  it('rotateRectanglePolygon returns same polygon for invalid input', () => {
    expect(rotateRectanglePolygon(null, 10)).toBe(null);
    expect(rotateRectanglePolygon({ type: 'Point' }, 10)).toEqual({ type: 'Point' });
    expect(rotateRectanglePolygon({ type: 'Polygon', coordinates: [[]] }, 10)).toEqual({ type: 'Polygon', coordinates: [[]] });
  });

  it('rotateRectanglePolygon rotates around center by deltaDeg', () => {
    const poly = { type: 'Polygon', coordinates: [[[0,0],[2,0],[2,1],[0,1],[0,0]]] };
    const out = rotateRectanglePolygon(poly, 90);
    expect(out.type).toBe('Polygon');
    expect(out.coordinates[0]).toHaveLength(5);
    // Center remains (1,0.5)
    const c = out.coordinates[0];
    const cx = (c[0][0] + c[2][0]) / 2; const cy = (c[0][1] + c[2][1]) / 2;
    expect(Math.abs(cx - 1) < 1e-9).toBe(true);
    expect(Math.abs(cy - 0.5) < 1e-9).toBe(true);
  });

  it('rotateRectanglePolygonScreen uses project/unproject for rotation', () => {
    const map = makeMapMock();
    const poly = { type: 'Polygon', coordinates: [[[0,0],[2,0],[2,2],[0,2],[0,0]]] };
    const out = rotateRectanglePolygonScreen(map, poly, 45);
    expect(out.type).toBe('Polygon');
    expect(out.coordinates[0]).toHaveLength(5);
    // ensure map methods called
    expect(map.project).toHaveBeenCalled();
    expect(map.unproject).toHaveBeenCalled();
  });
});


