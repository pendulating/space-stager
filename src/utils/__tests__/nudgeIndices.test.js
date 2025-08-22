import { describe, it, expect } from 'vitest';
import { createIndex, updateIndex, queryWithinRadius } from '../nudgeSpatialIndex.js';
import { createTextIndex, updateTextIndex, search } from '../nudgeTextIndex.js';

describe('nudge indices stubs', () => {
  it('spatial index API returns stable shapes', () => {
    const idx = createIndex('hydrants', []);
    expect(idx).toEqual({ ready: false });
    const up = updateIndex(idx, { add: [], remove: [] });
    expect(up).toEqual({ ready: false });
    const res = queryWithinRadius(idx, -74, 40.7, 50);
    expect(Array.isArray(res)).toBe(true);
  });

  it('text index API returns stable shapes', () => {
    const t = createTextIndex([]);
    expect(t).toEqual({ ready: false });
    const up = updateTextIndex(t, { add: [], remove: [] });
    expect(up).toEqual({ ready: false });
    const hits = search(t, { mode: 'regex', pattern: '.*' });
    expect(Array.isArray(hits)).toBe(true);
  });
});


