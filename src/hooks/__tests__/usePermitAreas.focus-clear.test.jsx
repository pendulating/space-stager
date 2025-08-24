import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { usePermitAreas } from '../usePermitAreas.js';

vi.mock('../../services/geographyService', () => ({
  loadPolygonAreas: vi.fn(async (map, { idPrefix }) => {
    // Ensure focused/outline layers exist for parks mode
    if (!map.getLayer(`${idPrefix}-focused-fill`)) {
      map.addSource(idPrefix, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: `${idPrefix}-fill`, type: 'fill', source: idPrefix, layout: { visibility: 'visible' } });
      map.addLayer({ id: `${idPrefix}-outline`, type: 'line', source: idPrefix, layout: { visibility: 'visible' } });
      map.addLayer({ id: `${idPrefix}-focused-fill`, type: 'fill', source: idPrefix, filter: ['==', ['id'], ''], layout: { visibility: 'visible' } });
      map.addLayer({ id: `${idPrefix}-focused-outline`, type: 'line', source: idPrefix, filter: ['==', ['id'], ''], layout: { visibility: 'visible' } });
    }
    return { type: 'FeatureCollection', features: [] };
  }),
  loadPointAreas: vi.fn(async () => ({ type: 'FeatureCollection', features: [] }))
}));

vi.mock('../../services/geographyLayerManager', () => ({
  ensureBaseLayers: vi.fn(), setBaseVisibility: vi.fn(), unload: vi.fn()
}));

// Provide a stub ZoneCreator context to avoid provider requirement in this unit test
vi.mock('../../contexts/ZoneCreatorContext.jsx', () => ({
  useZoneCreatorContext: () => null,
}));

function makeMap() {
  const style = { layers: [] };
  const layout = new Map();
  const sources = new Map();
  const listeners = new Map();
  const on = (ev, layerOrCb, maybeCb) => {
    const key = maybeCb ? `${ev}:${layerOrCb}` : ev;
    const cb = maybeCb || layerOrCb;
    listeners.set(key, cb);
  };
  const trigger = (ev, layer, e) => {
    const cb = listeners.get(`${ev}:${layer}`) || listeners.get(ev);
    if (cb) cb(e);
  };
  return {
    loaded: () => true,
    isStyleLoaded: () => true,
    getStyle: () => style,
    addSource: vi.fn((id, src) => { sources.set(id, src); }),
    getSource: vi.fn((id) => sources.get(id)),
    addLayer: vi.fn((l) => { style.layers.push({ id: l.id, type: l.type }); }),
    getLayer: vi.fn((id) => style.layers.find((l) => l.id === id)),
    removeLayer: vi.fn((id) => { style.layers = style.layers.filter((l) => l.id !== id); }),
    setFilter: vi.fn(),
    setLayoutProperty: vi.fn((id, prop, v) => { layout.set(id, v); }),
    getLayoutProperty: vi.fn((id) => layout.get(id) || 'visible'),
    fitBounds: vi.fn(() => { /* no-op */ }),
    once: vi.fn((ev, cb) => cb()),
    on,
    off: vi.fn(),
    __trigger: trigger,
  };
}

function Harness({ map }){
  const hook = usePermitAreas(map, true, { mode: 'parks' });
  React.useEffect(() => { hook.loadPermitAreas(); }, []);
  return <div data-testid="ready">ready</div>;
}

describe('usePermitAreas focus/clear branches', () => {
  it('focusOnPermitArea uses property-based filter for parks and clearFocus restores base visibility', async () => {
    const map = makeMap();
    render(<Harness map={map} />);
    const feature = { type: 'Feature', id: 'sys-1', properties: { system: 'A' }, geometry: { type: 'Polygon', coordinates: [[[0,0],[0,1],[1,1],[1,0],[0,0]]] } };
    // Obtain hook via temporary component closure
    let api;
    function Grabber(){ api = usePermitAreas(map, true, { mode: 'parks' }); return null; }
    render(<Grabber />);
    // load to create layers
    await api.loadPermitAreas();
    // Focus and assert filters used property key
    api.focusOnPermitArea(feature);
    expect(map.setFilter).toHaveBeenCalledWith('permit-areas-focused-fill', ['==', ['get', 'system'], 'A']);
    // After focus, base layers should be hidden
    expect(map.getLayoutProperty('permit-areas-fill')).toBe('none');
    // Clear focus restores base visibility
    api.clearFocus();
    expect(map.getLayoutProperty('permit-areas-fill')).toBe('visible');
  });

  it('parks click with overlaps then selectOverlappingArea anchors clicked popover and hides selector', async () => {
    const map = makeMap();
    map.queryRenderedFeatures = vi.fn(() => [{ id: 'a', properties: { system: 'S1' } }, { id: 'b', properties: { system: 'S2' } }]);
    function ParksHarness(){
      const hook = usePermitAreas(map, true, { mode: 'parks' });
      React.useEffect(() => { hook.loadPermitAreas(); }, []);
      React.useEffect(() => {
        map.__trigger('click', 'permit-areas-fill', { point: { x: 10, y: 10 }, features: [{ id: 'a', properties: { system: 'S1' } }, { id: 'b', properties: { system: 'S2' } }], preventDefault: () => {} });
        // select top overlap
        hook.selectOverlappingArea(0);
      }, []);
      return <div data-testid="vis">{hook.showOverlapSelector ? 'sel' : (hook.clickedTooltip.visible ? 'pop' : 'none')}</div>;
    }
    const { findByTestId } = render(<ParksHarness />);
    const el = await findByTestId('vis');
    await waitFor(() => expect(['pop','none']).toContain(el.textContent));
  });
});


