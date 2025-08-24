import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { usePermitAreas } from '../usePermitAreas.js';

vi.mock('../../services/permitAreaService', () => ({
  searchPermitAreas: (areas, q) => areas,
  highlightOverlappingAreas: vi.fn(),
  clearOverlapHighlights: vi.fn()
}));

vi.mock('../../services/geographyService', () => ({
  loadPolygonAreas: vi.fn(async (map, { idPrefix }) => {
    // Seed source and base/focused layers so hover outline operations can occur
    if (!map.getLayer(`${idPrefix}-fill`)) {
      map.addSource(idPrefix, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: `${idPrefix}-fill`, type: 'fill', source: idPrefix, layout: { visibility: 'visible' } });
      map.addLayer({ id: `${idPrefix}-outline`, type: 'line', source: idPrefix, layout: { visibility: 'visible' } });
      map.addLayer({ id: `${idPrefix}-focused-fill`, type: 'fill', source: idPrefix, filter: ['==', ['id'], ''], layout: { visibility: 'visible' } });
      map.addLayer({ id: `${idPrefix}-focused-outline`, type: 'line', source: idPrefix, filter: ['==', ['id'], ''], layout: { visibility: 'visible' } });
      // Create hover outline layer initially with empty filter
      map.addLayer({ id: `${idPrefix}-hover-outline`, type: 'line', source: idPrefix, filter: ['==', ['id'], ''], layout: { visibility: 'visible' } });
    }
    return { type: 'FeatureCollection', features: [] };
  }),
}));

vi.mock('../../services/geographyLayerManager', () => ({
  ensureBaseLayers: vi.fn(), setBaseVisibility: vi.fn(), unload: vi.fn()
}));

vi.mock('../../contexts/ZoneCreatorContext.jsx', () => ({
  useZoneCreatorContext: () => null
}));

function makeMap() {
  const style = { layers: [ { id: 'permit-areas-hover-outline', type: 'line' } ] };
  const listeners = new Map();
  const layout = new Map();
  const on = vi.fn((ev, layerOrCb, maybeCb) => {
    const key = maybeCb ? `${ev}:${layerOrCb}` : ev;
    const cb = maybeCb || layerOrCb;
    listeners.set(key, cb);
  });
  const trigger = (ev, layer, e) => {
    const cb = listeners.get(`${ev}:${layer}`) || listeners.get(ev);
    if (cb) cb(e || {});
  };
  return {
    loaded: () => true,
    isStyleLoaded: () => true,
    getStyle: () => style,
    addSource: vi.fn(),
    addLayer: vi.fn((l, before) => { style.layers.push({ id: l.id, type: l.type }); }),
    getLayer: vi.fn((id) => style.layers.find((l) => l.id === id)),
    removeLayer: vi.fn((id) => { style.layers = style.layers.filter((l) => l.id !== id); }),
    setFilter: vi.fn(),
    setLayoutProperty: vi.fn((id, prop, v) => { layout.set(id, v); }),
    getLayoutProperty: vi.fn((id) => layout.get(id) || 'visible'),
    queryRenderedFeatures: vi.fn(() => []),
    getCanvas: () => ({ style: { cursor: '' } }),
    on,
    off: vi.fn(),
    once: vi.fn((ev, cb) => cb()),
    __trigger: trigger
  };
}

function Harness({ map }) {
  const hook = usePermitAreas(map, true, { mode: 'parks' });
  React.useEffect(() => { hook.loadPermitAreas(); }, []);
  return <div data-testid="ok">ok</div>;
}

describe('usePermitAreas hover/click polygon behavior', () => {
  it('on mousemove selects smallest polygon under cursor and sets hover outline filter', async () => {
    const map = makeMap();
    // Ensure hover outline layer will be added by hook after load
    render(<Harness map={map} />);
    // Wait for loadPermitAreas to attach listeners
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    // Provide two polygons with different areas via queryRenderedFeatures
    const big = { id: 'big', geometry: { type: 'Polygon', coordinates: [[[0,0],[0,3],[3,3],[3,0],[0,0]]] } };
    const small = { id: 'small', geometry: { type: 'Polygon', coordinates: [[[0,0],[0,1],[1,1],[1,0],[0,0]]] } };
    map.queryRenderedFeatures = vi.fn(() => [big, small]);
    // Trigger move over permit-areas-fill (parks mode)
    map.__trigger('mousemove', 'permit-areas-fill', { point: { x: 10, y: 10 }, features: [{ properties: { name: 'x' } }] });
    // Expect hover-outline filter set to 'small'
    expect(map.setFilter).toHaveBeenCalledWith('permit-areas-hover-outline', ['==', ['id'], 'small']);
  });

  it('on mouseleave clears hover outline filter to empty', async () => {
    const map = makeMap();
    render(<Harness map={map} />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    map.__trigger('mouseleave', 'permit-areas-fill');
    expect(map.setFilter).toHaveBeenCalledWith('permit-areas-hover-outline', ['==', ['id'], '']);
  });

  it('general click outside clears overlap highlights in parks mode', async () => {
    const map = makeMap();
    const { clearOverlapHighlights } = await import('../../services/permitAreaService');
    render(<Harness map={map} />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    map.queryRenderedFeatures = vi.fn(() => []);
    map.__trigger('click', undefined, { point: { x: 5, y: 5 } });
    expect(clearOverlapHighlights).toHaveBeenCalled();
  });
});


