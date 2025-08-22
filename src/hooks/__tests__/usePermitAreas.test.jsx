import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('../../services/permitAreaService', () => ({
  searchPermitAreas: (areas, q) => areas.filter(a => (a.properties?.name || '').toLowerCase().includes(String(q).toLowerCase())).slice(0, 10),
  highlightOverlappingAreas: vi.fn(),
  clearOverlapHighlights: vi.fn()
}));

vi.mock('../../services/geographyService', () => ({
  loadPolygonAreas: vi.fn(async (map, { idPrefix }) => {
    // Simulate loader side-effect: add the source and layers
    try {
      map.addSource(idPrefix, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    } catch {}
    try { map.addLayer({ id: `${idPrefix}-fill`, type: 'fill', source: idPrefix }); } catch {}
    try { map.addLayer({ id: `${idPrefix}-outline`, type: 'line', source: idPrefix }); } catch {}
    return {
      type: 'FeatureCollection',
      features: [
        { id: 'a1', type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] }, properties: { name: 'Union Park', CEMSID: '111' } },
        { id: 'a2', type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[2,2],[3,2],[3,3],[2,3],[2,2]]] }, properties: { name: 'Columbus Park', CEMSID: '222' } }
      ]
    };
  }),
  loadPointAreas: vi.fn(async () => ({ type: 'FeatureCollection', features: [] }))
}));

vi.mock('../../services/geographyLayerManager', () => ({
  ensureBaseLayers: vi.fn(),
  setBaseVisibility: vi.fn(),
  unload: vi.fn()
}));

vi.mock('../../contexts/ZoneCreatorContext.jsx', () => ({
  useZoneCreatorContext: () => ({ isActive: false })
}));

import { usePermitAreas } from '../usePermitAreas.js';

function createMapMock() {
  const sourceData = new Map();
  const listeners = new Map();
  const style = { layers: [] };
  return {
    loaded: () => true,
    isStyleLoaded: () => true,
    getStyle: () => style,
    getCanvas: () => ({ style: {} }),
    addSource: vi.fn((id, src) => { sourceData.set(id, { ...src, setData: vi.fn() }); }),
    getSource: vi.fn((id) => sourceData.get(id)),
    removeSource: vi.fn(id => { sourceData.delete(id); }),
    addLayer: vi.fn((layer) => { style.layers.push({ id: layer.id, type: layer.type }); }),
    getLayer: vi.fn((id) => style.layers.find(l => l.id === id)),
    removeLayer: vi.fn((id) => { style.layers = style.layers.filter(l => l.id !== id); }),
    setFilter: vi.fn(),
    setLayoutProperty: vi.fn(),
    setMaxBounds: vi.fn(),
    setMinZoom: vi.fn(),
    getZoom: () => 15,
    getCenter: () => ({ lng: -73.98, lat: 40.75 }),
    setCenter: vi.fn(),
    cameraForBounds: () => ({ center: [ -73.98, 40.75 ], zoom: 15 }),
    fitBounds: vi.fn(),
    rotateTo: vi.fn(),
    easeTo: vi.fn(),
    stop: vi.fn(),
    project: ({ lng, lat }) => ({ x: lng * 10, y: lat * -10, toArray: () => [lng * 10, lat * -10] }),
    unproject: ([x, y]) => ({ lng: x / 10, lat: -y / 10, toArray: () => [x / 10, -y / 10] }),
    getBounds: () => ({ getWest: () => -74, getSouth: () => 40.7, getEast: () => -73.9, getNorth: () => 40.8 }),
    dragRotate: { disable: vi.fn(), enable: vi.fn() },
    touchZoomRotate: { disableRotation: vi.fn(), enable: vi.fn(), enableRotation: vi.fn() },
    on: vi.fn((event, cb) => { listeners.set(event, cb); }),
    off: vi.fn((event) => { listeners.delete(event); }),
    once: vi.fn((event, cb) => { if (typeof cb === 'function') cb(); })
  };
}

function TestHarness({ map, mode = 'parks' }) {
  const hook = usePermitAreas(map, true, { mode });
  return (
    <div>
      <div data-testid="count">{hook.permitAreas.length}</div>
      <button onClick={() => hook.loadPermitAreas()} data-testid="load">Load</button>
      <button onClick={() => hook.rehydrateActiveGeography()} data-testid="rehydrate">Rehydrate</button>
      <button onClick={() => hook.focusOnPermitArea(hook.permitAreas[0])} data-testid="focus">Focus</button>
      <input aria-label="q" onChange={(e) => hook.setSearchQuery(e.target.value)} />
      <div data-testid="search-count">{hook.searchResults.length}</div>
      <div data-testid="focused">{hook.focusedArea ? 'yes' : 'no'}</div>
      <div data-testid="showFocusInfo">{hook.showFocusInfo ? 'yes' : 'no'}</div>
    </div>
  );
}

describe('usePermitAreas', () => {
  it('loads features, caches, and rehydrates source data', async () => {
    const map = createMapMock();
    render(<TestHarness map={map} />);
    fireEvent.click(screen.getByTestId('load'));
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
    // Rehydrate should push cached data back into the source
    fireEvent.click(screen.getByTestId('rehydrate'));
    await waitFor(() => {
      const src = map.getSource('permit-areas');
      expect(src && typeof src.setData === 'function').toBe(true);
    });
  });

  it('debounces search and filters results from permitAreas', async () => {
    const map = createMapMock();
    render(<TestHarness map={map} />);
    fireEvent.click(screen.getByTestId('load'));
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
    const input = screen.getByLabelText('q');
    act(() => { fireEvent.change(input, { target: { value: 'union' } }); });
    await new Promise((r) => setTimeout(r, 350));
    await waitFor(() => expect(screen.getByTestId('search-count').textContent).toBe('1'));
  });

  it('focusOnPermitArea sets focused state and shows focus info', async () => {
    const map = createMapMock();
    render(<TestHarness map={map} />);
    fireEvent.click(screen.getByTestId('load'));
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
    fireEvent.click(screen.getByTestId('focus'));
    await new Promise((r) => setTimeout(r, 0));
    await waitFor(() => expect(screen.getByTestId('focused').textContent).toBe('yes'));
    await waitFor(() => expect(screen.getByTestId('showFocusInfo').textContent).toBe('yes'));
  });
});


