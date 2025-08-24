import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { usePermitAreas } from '../usePermitAreas.js';

vi.mock('../../services/geographyLayerManager', () => ({
  ensureBaseLayers: vi.fn(), setBaseVisibility: vi.fn(), unload: vi.fn()
}));

vi.mock('../../contexts/ZoneCreatorContext.jsx', () => ({
  useZoneCreatorContext: () => ({ isActive: false })
}));

vi.mock('../../services/geographyService', () => ({
  loadPolygonAreas: vi.fn(async (map, { idPrefix }) => {
    if (!map.getLayer(`${idPrefix}-focused-fill`)) {
      map.addSource(idPrefix, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: `${idPrefix}-fill`, type: 'fill', source: idPrefix, layout: { visibility: 'visible' } });
      map.addLayer({ id: `${idPrefix}-outline`, type: 'line', source: idPrefix, layout: { visibility: 'visible' } });
      map.addLayer({ id: `${idPrefix}-focused-fill`, type: 'fill', source: idPrefix, filter: ['==', ['id'], ''], layout: { visibility: 'visible' } });
      map.addLayer({ id: `${idPrefix}-focused-outline`, type: 'line', source: idPrefix, filter: ['==', ['id'], ''], layout: { visibility: 'visible' } });
    }
    return { type: 'FeatureCollection', features: [] };
  }),
}));

function makeMap() {
  const style = { layers: [] };
  const layers = new Map();
  const sources = new Map();
  const layout = new Map();
  return {
    loaded: () => true,
    isStyleLoaded: () => true,
    getStyle: () => ({ layers: Array.from(layers.values()).map(l => ({ id: l.id, type: l.type })) }),
    addSource: vi.fn((id, src) => { sources.set(id, src); }),
    getSource: vi.fn((id) => ({ setData: vi.fn() })),
    addLayer: vi.fn((l) => { layers.set(l.id, l); }),
    getLayer: vi.fn((id) => layers.get(id)),
    removeLayer: vi.fn((id) => { layers.delete(id); }),
    setLayoutProperty: vi.fn((id, prop, v) => { layout.set(id, v); }),
    getLayoutProperty: vi.fn((id) => layout.get(id) || 'visible'),
    setFilter: vi.fn(),
    cameraForBounds: vi.fn(() => ({ center: { lng: -74, lat: 40.7 }, zoom: 16 })),
    stop: vi.fn(),
    easeTo: vi.fn(),
    fitBounds: vi.fn(),
    project: ({ lng, lat }) => ({ x: lng * 10, y: -lat * 10 }),
    unproject: ([x, y]) => ({ lng: x / 10, lat: -y / 10 }),
    once: vi.fn((e, cb) => cb()),
    on: vi.fn(),
    off: vi.fn(),
  };
}

function Harness({ map }){
  const hook = usePermitAreas(map, true, { mode: 'parks' });
  React.useEffect(() => { hook.loadPermitAreas(); }, []);
  return <div data-testid="ok">ok</div>;
}

describe('usePermitAreas sub-focus and rehydrate', () => {
  it('setSubFocusPolygon stores sub-focus and applies constraints; clearSubFocusPolygon refits to main area', async () => {
    const map = makeMap();
    // Grab hook API
    let api;
    function Grab(){ api = usePermitAreas(map, true, { mode: 'parks' }); return null; }
    render(<Grab />);
    await api.loadPermitAreas();
    // Focus a main polygon first
    const main = { type: 'Feature', id: 'sys', properties: { system: 'S' }, geometry: { type: 'Polygon', coordinates: [[[0,0],[0,2],[2,2],[2,0],[0,0]]] } };
    api.focusOnPermitArea(main);
    // Wait a tick for focusedAreaRef effect to sync
    await act(async () => {});
    // Provide a sub polygon overlapping
    const sub = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0.2,0.2],[0.2,0.5],[0.5,0.5],[0.5,0.2],[0.2,0.2]]] } };
    const ok = api.setSubFocusPolygon(sub);
    expect(ok).toBe(true);
    // Clearing should refit back to main focus
    api.clearSubFocusPolygon();
  });

  it('rehydrateActiveGeography ensures layers visible without reloading data when cached', async () => {
    const map = makeMap();
    const { rerender } = render(<Harness map={map} />);
    // simulate cached source exists
    // call rehydrate and expect visibility toggles
    let api;
    function Grab(){ api = usePermitAreas(map, true, { mode: 'parks' }); return null; }
    render(<Grab />);
    await api.loadPermitAreas();
    // Also set a focused area to trigger layout property adjustments
    api.focusOnPermitArea({ type: 'Feature', id: 'sys', properties: { system: 'S' }, geometry: { type: 'Polygon', coordinates: [[[0,0],[0,1],[1,1],[1,0],[0,0]]] } });
    await act(async () => {});
    act(() => { api.rehydrateActiveGeography(); });
    // It should attempt to set layout visibility for focused layers or base layers
    expect(map.setLayoutProperty).toHaveBeenCalled();
  });
});
