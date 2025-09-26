import React, { useEffect, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { useInfrastructure } from '../useInfrastructure.js';
import { loadInfrastructureData } from '../../services/infrastructureService.js';

vi.mock('../../services/infrastructureService', () => ({
  loadInfrastructureData: vi.fn(async () => ({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0,0] } },
      { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[0,0],[1,0]] } },
    ]
  })),
  filterFeaturesByType: vi.fn((fs) => fs),
  getLayerStyle: vi.fn(() => ({ type: 'symbol', paint: {}, layout: { 'icon-image': 'x', 'icon-size': 1 } })),
}));

vi.mock('../../utils/iconUtils', () => ({ addIconsToMap: vi.fn(), retryLoadIcons: vi.fn() }));

const computeSpriteTransformMock = vi.fn(() => ({ imageId: 'linknyc_000', iconRotate: 0 }));

vi.mock('../../utils/enhancedRenderingUtils.js', async (orig) => {
  const mod = await orig();
  return {
    ...mod,
    computeSpriteTransform: (...args) => computeSpriteTransformMock(...args),
  };
});

function createMockMap() {
  const sources = new Map();
  const layers = new Map();
  const style = { layers: [] };
  const canvas = { style: { cursor: '' } };
  const listeners = new Map();
  return {
    getStyle: () => style,
    isStyleLoaded: () => true,
    getCanvas: () => canvas,
    addSource: vi.fn((id, src) => sources.set(id, src)),
    getSource: vi.fn((id) => sources.get(id)),
    removeSource: vi.fn((id) => sources.delete(id)),
    addLayer: vi.fn((layer) => { layers.set(layer.id, layer); style.layers.push({ id: layer.id, type: layer.type }); }),
    getLayer: vi.fn((id) => layers.get(id)),
    removeLayer: vi.fn((id) => { layers.delete(id); style.layers = style.layers.filter((l) => l.id !== id); }),
    setLayoutProperty: vi.fn(),
    on: vi.fn((evt, fn) => {
      const arr = listeners.get(evt) || [];
      arr.push(fn);
      listeners.set(evt, arr);
    }),
    off: vi.fn((evt, fn) => {
      const arr = listeners.get(evt) || [];
      listeners.set(evt, arr.filter((cb) => cb !== fn));
    }),
    emit: (evt, ...args) => {
      const arr = listeners.get(evt) || [];
      arr.forEach((cb) => cb(...args));
    }
  };
}

function Harness({ map, focusedArea, initialLayers, onApi }) {
  const [layers, setLayers] = useState(initialLayers);
  const api = useInfrastructure(map, focusedArea, layers, setLayers);
  useEffect(() => {
    onApi && onApi({ ...api, layers, setLayers });
  });
  return null;
}

const focusedArea = { id: 'fa', geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] }, properties: { name: 'Area' } };

describe('useInfrastructure more branches', () => {
  it('toggle visibility off calls setLayoutProperty on layers', async () => {
    const map = createMockMap();
    const apiRef = { current: null };
    const initialLayers = { permitAreas: { visible: true }, benches: { visible: false, loaded: false, loading: false } };
    render(<Harness map={map} focusedArea={focusedArea} initialLayers={initialLayers} onApi={(api) => (apiRef.current = api)} />);
    await waitFor(() => apiRef.current);
    act(() => { apiRef.current.toggleLayer('benches'); });
    await waitFor(() => expect(loadInfrastructureData).toHaveBeenCalled());
    // Now turn off and expect layout visibility toggles
    act(() => { apiRef.current.toggleLayer('benches'); });
    expect(map.setLayoutProperty).toHaveBeenCalled();
  });

  it('reloadVisibleLayers triggers loader for visible layers', async () => {
    const map = createMockMap();
    const apiRef = { current: null };
    const initialLayers = { permitAreas: { visible: true }, bikeParking: { visible: true, loaded: false, loading: false } };
    render(<Harness map={map} focusedArea={focusedArea} initialLayers={initialLayers} onApi={(api) => (apiRef.current = api)} />);
    await waitFor(() => apiRef.current);
    act(() => { apiRef.current.reloadVisibleLayers(); });
    await waitFor(() => expect(loadInfrastructureData).toHaveBeenCalled());
  });

  it('error path marks layer error and resets flags', async () => {
    const map = createMockMap();
    const apiRef = { current: null };
    const initialLayers = { permitAreas: { visible: true }, bikeLanes: { visible: false, loaded: false, loading: false } };
    // Make loader throw
    loadInfrastructureData.mockRejectedValueOnce(new Error('fail'));
    render(<Harness map={map} focusedArea={focusedArea} initialLayers={initialLayers} onApi={(api) => (apiRef.current = api)} />);
    await waitFor(() => apiRef.current);
    act(() => { apiRef.current.toggleLayer('bikeLanes'); });
    await waitFor(() => {
      const l = apiRef.current.layers.bikeLanes;
      expect(l.error).toBe(true);
      expect(l.visible).toBe(false);
      expect(l.loaded).toBe(false);
      expect(l.loading).toBe(false);
    });
  });
});


