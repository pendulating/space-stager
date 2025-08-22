import { describe, it, expect } from 'vitest';
import { calculateGeometryBounds, expandBounds, getAreaDisplayName, getAreaDescription } from '../geometryUtils.js';

describe('geometryUtils', () => {
  it('calculateGeometryBounds returns bbox for Polygon', () => {
    const geom = { type: 'Polygon', coordinates: [[[0,0],[2,1],[1,3],[0,0]]] };
    expect(calculateGeometryBounds(geom)).toEqual([[0,0],[2,3]]);
  });

  it('calculateGeometryBounds returns bbox for MultiPolygon', () => {
    const geom = { type: 'MultiPolygon', coordinates: [
      [[[0,0],[1,1],[0,1],[0,0]]],
      [[[2,2],[3,4],[2,4],[2,2]]]
    ]};
    expect(calculateGeometryBounds(geom)).toEqual([[0,0],[3,4]]);
  });

  it('calculateGeometryBounds returns null for unsupported geometry', () => {
    expect(calculateGeometryBounds({ type: 'Point', coordinates: [0,0] })).toBeNull();
    expect(calculateGeometryBounds(null)).toBeNull();
  });

  it('expandBounds expands by factor', () => {
    const b = [[-1,-2],[3,4]];
    expect(expandBounds(b, 0.5)).toEqual([[-1.5,-2.5],[3.5,4.5]]);
  });

  it('getAreaDisplayName falls back to Unnamed Area', () => {
    expect(getAreaDisplayName(null)).toBe('Unnamed Area');
    expect(getAreaDisplayName({ properties: {} })).toBe('Unnamed Area');
    expect(getAreaDisplayName({ properties: { name: 'Park' } })).toBe('Park');
  });

  it('getAreaDescription joins property and subproperty', () => {
    expect(getAreaDescription(null)).toBe('');
    expect(getAreaDescription({ properties: { propertyname: 'A' } })).toBe('A');
    expect(getAreaDescription({ properties: { subpropertyname: 'B' } })).toBe('B');
    expect(getAreaDescription({ properties: { propertyname: 'A', subpropertyname: 'B' } })).toBe('A › B');
  });
});


