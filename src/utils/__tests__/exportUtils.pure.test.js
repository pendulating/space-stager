import { describe, it, expect, vi } from 'vitest';
import * as exportUtils from '../exportUtils.js';

describe('exportUtils pure helpers', () => {
  it('getSiteplanTitleParts builds title and subtitle from FSN fields', () => {
    const area = { properties: { FSN_1: 'Main', FSN_2: '1st Ave', FSN_3: 'North', FSN_4: '' } };
    const parts = exportUtils.__getSiteplanTitleParts(area);
    expect(parts).toEqual({ title: 'Main & 1st Ave', subtitle: 'North' });
    const area2 = { properties: { name: 'Union Square' } };
    const parts2 = exportUtils.__getSiteplanTitleParts(area2);
    expect(parts2.title).toBe('Union Square');
  });

  it('wrapCanvasLines wraps long text by canvas measureText', () => {
    const widths = { T: 5, Te: 10, Tes: 15 };
    const ctx = { measureText: (t) => ({ width: t.length }) };
    const lines = exportUtils.__wrapCanvasLines(ctx, 'The quick brown', 5);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('getPermitAreaBounds computes bbox for Polygon and MultiPolygon', () => {
    const poly = { geometry: { type: 'Polygon', coordinates: [[[-74,40.7],[-74,40.8],[-73.9,40.8],[-73.9,40.7],[-74,40.7]]] } };
    const bbox = exportUtils.__getPermitAreaBounds(poly);
    expect(bbox).toEqual([[-74,40.7],[-73.9,40.8]]);
    const mpoly = { geometry: { type: 'MultiPolygon', coordinates: [[[[-74,40.7],[-73.95,40.7],[-73.95,40.72],[-74,40.72],[-74,40.7]]]] } };
    const bbox2 = exportUtils.__getPermitAreaBounds(mpoly);
    expect(bbox2).toEqual([[-74,40.7],[-73.95,40.72]]);
  });

  it('getSafeFilename slugifies and appends date', () => {
    const area = { properties: { name: 'Union Square / Test' } };
    const out = exportUtils.__getSafeFilename(area);
    expect(out.startsWith('union-square---test-')).toBe(true);
  });
});


