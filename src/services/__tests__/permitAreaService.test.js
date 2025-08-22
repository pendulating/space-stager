import { describe, it, expect, vi } from 'vitest';
import { searchPermitAreas, highlightOverlappingAreas, clearOverlapHighlights } from '../permitAreaService.js';

function createMockMap() {
  const layers = new Map();
  return {
    getLayer: vi.fn((id) => layers.get(id)),
    addLayer: vi.fn((layer) => layers.set(layer.id, layer)),
    removeLayer: vi.fn((id) => layers.delete(id)),
    _layers: layers
  };
}

describe('permitAreaService helpers', () => {
  it('searchPermitAreas filters by multiple fields case-insensitively', () => {
    const areas = [
      { properties: { name: 'Columbus Park', propertyname: 'Columbus', subpropertyname: 'North', FSN_1: 'CP-1' } },
      { properties: { name: 'Union Square', propertyname: 'Union', subpropertyname: 'East', FSN_1: 'US-1' } },
      { properties: { name: 'Bryant Park', propertyname: 'Bryant', subpropertyname: 'Main', FSN_1: 'BP-1' } },
    ];
    const res = searchPermitAreas(areas, 'union');
    expect(res).toHaveLength(1);
    expect(res[0].properties.name).toBe('Union Square');
  });

  it('highlightOverlappingAreas adds highlight layer with correct filter then clear removes it', () => {
    const map = createMockMap();
    const features = [
      { id: 'a', properties: { id: 'a' } },
      { properties: { OBJECTID: 42 } },
      { properties: { fid: 7 } }
    ];
    highlightOverlappingAreas(map, features);
    const layer = map._layers.get('permit-areas-overlap-highlight');
    expect(layer).toBeTruthy();
    expect(layer.type).toBe('line');
    expect(layer.filter[0]).toBe('in');

    clearOverlapHighlights(map);
    expect(map._layers.get('permit-areas-overlap-highlight')).toBeUndefined();
  });

  it('highlightOverlappingAreas no-ops on empty ids and does not add layer', () => {
    const map = createMockMap();
    highlightOverlappingAreas(map, [ { properties: {} } ]);
    expect(map._layers.get('permit-areas-overlap-highlight')).toBeUndefined();
  });
});


