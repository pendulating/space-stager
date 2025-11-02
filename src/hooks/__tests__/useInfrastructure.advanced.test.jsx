import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInfrastructure } from '../useInfrastructure.js';

vi.mock('../../utils/geometryUtils', () => ({ calculateGeometryBounds: () => [[0,0],[1,1]], expandBounds: (b) => b }));
vi.mock('../../utils/enhancedRenderingUtils.js', () => ({
  extractCameraState: () => ({ viewType: 'top-down' }),
  getMapViewType: () => 'top-down'
}));
vi.mock('../../utils/iconUtils', () => ({ addIconsToMap: () => {} }));
vi.mock('../../services/infrastructureService', () => ({
  loadInfrastructureData: vi.fn(async (layerId) => ({ type: 'FeatureCollection', features: layerId === 'trees' ? [{ geometry: { type: 'Point', coordinates: [0,0] }, properties: {} }] : [] })),
  filterFeaturesByType: (f) => f,
  getLayerStyle: () => ({ type: 'symbol', paint: {}, layout: {} })
}));

function makeMap() {
  const handlers = {};
  const layers = [];
  const sources = new Map();
  return {
    on: vi.fn((evt, cb) => { handlers[evt] = cb; }),
    once: vi.fn((evt, cb) => { cb && cb(); }),
    off: vi.fn(),
    isStyleLoaded: () => true,
    getStyle: () => ({ layers }),
    addSource: vi.fn((id, def) => { sources.set(id, { _data: def.data, setData: vi.fn(function(d){ this._data = d; }) }); }),
    getSource: vi.fn((id) => sources.get(id)),
    removeSource: vi.fn((id) => { sources.delete(id); }),
    addLayer: vi.fn((def) => { layers.push(def); }),
    getLayer: vi.fn((id) => layers.find(l => l.id === id)),
    removeLayer: vi.fn((id) => { const i = layers.findIndex(l => l.id === id); if (i>=0) layers.splice(i,1); }),
    setLayoutProperty: vi.fn(),
    getLayoutProperty: vi.fn(() => 'visible'),
    getCenter: () => ({ lng: 0, lat: 0 }),
    getBearing: () => 0,
    getPitch: () => 0,
  };
}

function makeLayers() {
  return {
    trees: { requested: false, loaded: false, loading: false, disabled: false, enhancedRendering: { enabled: false } },
    hydrants: { requested: false, loaded: false, loading: false, disabled: false, enhancedRendering: { enabled: false } },
    permitAreas: { visible: true }
  };
}

describe('useInfrastructure advanced', () => {
  afterEach(() => vi.restoreAllMocks());

  it('toggleLayer: requests load when turning on; hides when turning off', () => {
    const map = makeMap();
    let layers = makeLayers();
    const setLayers = (updater) => { layers = typeof updater === 'function' ? updater(layers) : updater; };
    const { result } = renderHook(() => useInfrastructure(map, { id: 'fa1', geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } }, layers, setLayers));

    act(() => { result.current.toggleLayer('trees'); });
    expect(layers.trees.requested).toBe(true);

    act(() => { result.current.toggleLayer('trees'); });
    expect(layers.trees.requested).toBe(false);
    expect(layers.trees.visible).toBe(false);
  });

  it('clearFocus resets layer states and data', () => {
    const map = makeMap();
    let layers = makeLayers();
    layers.trees = { ...layers.trees, requested: true, loaded: true, visible: true };
    const setLayers = (updater) => { layers = typeof updater === 'function' ? updater(layers) : updater; };
    const { result } = renderHook(() => useInfrastructure(map, { id: 'fa1', geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } }, layers, setLayers));

    act(() => { result.current.clearFocus(); });
    expect(layers.trees.requested).toBe(false);
    expect(layers.trees.visible).toBe(false);
    expect(layers.trees.loaded).toBe(false);
  });

  it('reloadVisibleLayers enqueues visible requested layers after style change', () => {
    const map = makeMap();
    let layers = makeLayers();
    layers.trees = { ...layers.trees, requested: true, visible: true, loaded: false };
    const setLayers = (updater) => { layers = typeof updater === 'function' ? updater(layers) : updater; };
    const { result } = renderHook(() => useInfrastructure(map, { id: 'fa1', geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } }, layers, setLayers));

    act(() => { result.current.reloadVisibleLayers(); });
    // Side-effect only: ensure we didn't crash and state remains consistent
    expect(layers.trees.requested).toBe(true);
  });
});
