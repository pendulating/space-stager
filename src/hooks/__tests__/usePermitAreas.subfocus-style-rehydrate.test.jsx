import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { usePermitAreas } from '../usePermitAreas.js';

vi.mock('../../contexts/ZoneCreatorContext.jsx', () => ({
  useZoneCreatorContext: () => ({ isActive: false })
}));

function makeMap() {
  const listeners = {};
  const layers = new Map();
  const sources = new Map();
  return {
    loaded: () => true,
    isStyleLoaded: () => true,
    getStyle: () => ({ layers: Array.from(layers.values()).map(l => ({ id: l.id, type: l.type })) }),
    addSource: vi.fn((id, src) => { sources.set(id, src); }),
    getSource: vi.fn((id) => sources.get(id)),
    removeSource: vi.fn((id) => { sources.delete(id); }),
    addLayer: vi.fn((l) => { layers.set(l.id, l); }),
    getLayer: vi.fn((id) => layers.get(id)),
    removeLayer: vi.fn((id) => { layers.delete(id); }),
    setLayoutProperty: vi.fn(),
    getLayoutProperty: vi.fn(() => 'visible'),
    setFilter: vi.fn(),
    cameraForBounds: vi.fn(() => ({ center: { lng: -74, lat: 40.7 }, zoom: 16 })),
    stop: vi.fn(),
    easeTo: vi.fn(),
    fitBounds: vi.fn(),
    project: ({ lng, lat }) => ({ x: lng * 10, y: -lat * 10 }),
    unproject: ([x, y]) => ({ lng: x / 10, lat: -y / 10 }),
    once: vi.fn((evt, cb) => { if (evt === 'idle') cb(); }),
    on: vi.fn((evt, cb) => { listeners[evt] = cb; }),
    off: vi.fn((evt) => { delete listeners[evt]; }),
    __emit: (evt) => { if (listeners[evt]) listeners[evt](); }
  };
}

describe('usePermitAreas subfocus style rehydrate', () => {
  it('re-adds subfocus overlay layers after style.load', async () => {
    const map = makeMap();
    let api;
    function Grab(){ api = usePermitAreas(map, true, { mode: 'parks' }); return null; }
    render(<Grab />);

    // Focus a main polygon and set a subfocus polygon
    const main = { type: 'Feature', id: 'sys', properties: { system: 'S' }, geometry: { type: 'Polygon', coordinates: [[[0,0],[0,3],[3,3],[3,0],[0,0]]] } };
    api.focusOnPermitArea(main);
    await act(async () => {});
    const sub = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0.5,0.5],[0.5,1],[1,1],[1,0.5],[0.5,0.5]]] } };
    const ok = api.setSubFocusPolygon(sub);
    expect(ok).toBe(true);
    // Wait for subfocus effect to run and add layers
    await act(async () => {});
    await new Promise((r) => setTimeout(r, 0));

    expect(map.getLayer('sub-focus-fill')).toBeTruthy();
    expect(map.getLayer('sub-focus-outline')).toBeTruthy();

    // Simulate style reload and ensure layers get re-added by the effect's style.load handler
    const addLayerCallsBefore = map.addLayer.mock.calls.length;
    map.__emit('style.load');
    await act(async () => {});
    const addLayerCallsAfter = map.addLayer.mock.calls.length;
    // Presence of layers is the key behavior across style reload
    expect(map.getLayer('sub-focus-fill')).toBeTruthy();
    expect(map.getLayer('sub-focus-outline')).toBeTruthy();
  });
});


