import { describe, it, expect, vi } from 'vitest';
import ensureViewportAlignedSymbols, { ensureLayersBetweenPermitAreasAndDroppedObjects } from '../mapLayerUtils.js';

function makeMap({ layers = [] } = {}) {
  const layoutCalls = [];
  return {
    setLayoutProperty: vi.fn((id, prop, val) => { layoutCalls.push([id, prop, val]); }),
    moveLayer: vi.fn(),
    getStyle: () => ({ layers }),
    getLayer: vi.fn((id) => layers.find((l) => l && l.id === id) ? { id } : null),
    __layoutCalls: layoutCalls
  };
}

describe('mapLayerUtils.ensureViewportAlignedSymbols', () => {
  it('sets layout properties for provided ids and skips falsy ids', () => {
    const map = makeMap();
    ensureViewportAlignedSymbols(map, ['a', null, 'b']);
    // 4 props per valid id
    const setCalls = map.setLayoutProperty.mock.calls;
    expect(setCalls.length).toBe(8);
    const props = setCalls.map(c => c[1]);
    expect(props).toContain('icon-rotation-alignment');
    expect(props).toContain('icon-pitch-alignment');
    expect(props).toContain('icon-anchor');
    expect(props).toContain('icon-offset');
  });
});

describe('mapLayerUtils.ensureLayersBetweenPermitAreasAndDroppedObjects', () => {
  it('moves target layers before dropped-object layers, respecting permit areas order', () => {
    const layers = [
      { id: 'permit-areas-base' },
      { id: 'permit-areas-labels' },
      { id: 'target-1' },
      { id: 'dropped-objects-selected' },
      { id: 'dropped-objects-symbol' },
      { id: 'other' }
    ];
    const map = makeMap({ layers });
    ensureLayersBetweenPermitAreasAndDroppedObjects(map, ['target-1']);
    expect(map.moveLayer).toHaveBeenCalledWith('target-1', expect.anything());
  });

  it('falls back to moving target layers to top when permit areas are above dropped objects', () => {
    const layers = [
      { id: 'dropped-objects-selected' },
      { id: 'permit-areas-something' },
      { id: 'target-2' }
    ];
    const map = makeMap({ layers });
    ensureLayersBetweenPermitAreasAndDroppedObjects(map, ['target-2']);
    expect(map.moveLayer).toHaveBeenCalledWith('target-2', undefined);
  });
});


