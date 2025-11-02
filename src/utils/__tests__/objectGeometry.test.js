import { describe, it, expect } from 'vitest';
import { rotateRectanglePolygon, rotateRectanglePolygonScreen, rotateRectanglePolygonMercator } from '../objectGeometry.js';

const poly = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] };

function makeMap() {
  return {
    project: ([lng, lat]) => ({ x: (lng + 180) * 2, y: (90 - lat) * 2 }),
    unproject: ([x, y]) => ({ lng: x/2 - 180, lat: 90 - y/2 })
  };
}

describe('objectGeometry', () => {
  it('rotateRectanglePolygon rotates around center', () => {
    const out = rotateRectanglePolygon(poly, 45);
    expect(out.type).toBe('Polygon');
    expect(Array.isArray(out.coordinates[0])).toBe(true);
  });

  it('rotateRectanglePolygonScreen rotates using map projection', () => {
    const map = makeMap();
    const out = rotateRectanglePolygonScreen(map, poly, 30);
    expect(out.type).toBe('Polygon');
  });

  it('rotateRectanglePolygonMercator rotates in Mercator plane', () => {
    const out = rotateRectanglePolygonMercator(poly, -15);
    expect(out.type).toBe('Polygon');
  });
});
