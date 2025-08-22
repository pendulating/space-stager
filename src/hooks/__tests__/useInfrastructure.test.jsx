import React, { useEffect, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../services/infrastructureService', () => ({
  loadInfrastructureData: vi.fn(async () => ({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { id: 'p1' }, geometry: { type: 'Point', coordinates: [0, 0] } }
    ]
  })),
  filterFeaturesByType: vi.fn((features) => features),
  getLayerStyle: vi.fn(() => ({ type: 'circle', paint: {}, layout: {} }))
}));

vi.mock('../../utils/iconUtils', () => ({
  addIconsToMap: vi.fn(),
  retryLoadIcons: vi.fn()
}));

import { loadInfrastructureData, getLayerStyle } from '../../services/infrastructureService';
import { useInfrastructure } from '../useInfrastructure';

function createMockMap() {
  const sources = new Map();
  const layers = new Map();
  const style = { layers: [ { id: 'symbol-0', type: 'symbol' } ] };
  const canvas = { style: { cursor: '' } };
  const map = {
    getStyle: () => style,
    isStyleLoaded: () => true,
    loaded: () => true,
    getCanvas: () => canvas,
    addSource: vi.fn((id, src) => { sources.set(id, src); }),
    getSource: vi.fn((id) => sources.get(id)),
    removeSource: vi.fn((id) => { sources.delete(id); }),
    addLayer: vi.fn((layer) => { layers.set(layer.id, layer); style.layers.push({ id: layer.id, type: layer.type }); }),
    getLayer: vi.fn((id) => layers.get(id)),
    removeLayer: vi.fn((id) => { layers.delete(id); }),
    moveLayer: vi.fn(),
    setLayoutProperty: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  };
  return map;
}

function Harness({ map, focusedArea, initialLayers, onApi }) {
  const [layers, setLayers] = useState(initialLayers);
  const api = useInfrastructure(map, focusedArea, layers, setLayers);
  useEffect(() => { onApi && onApi({ ...api, layers, setLayers }); });
  return null;
}

const focusedArea = {
  id: 'area-1',
  geometry: {
    type: 'Polygon',
    coordinates: [[[ -74.01, 40.70 ], [ -74.01, 40.80 ], [ -73.90, 40.80 ], [ -73.90, 40.70 ], [ -74.01, 40.70 ]]]
  },
  properties: { name: 'Test Area' }
};

describe('useInfrastructure', () => {
  afterEach(() => {
    cleanup();
  });

  it('toggleLayer loads data, updates map and layer state', async () => {
    const map = createMockMap();
    const initialLayers = {
      permitAreas: { visible: true },
      bikeParking: { visible: false, loaded: false, loading: false }
    };
    const apiRef = { current: null };

    render(
      <Harness
        map={map}
        focusedArea={focusedArea}
        initialLayers={initialLayers}
        onApi={(api) => { apiRef.current = api; }}
      />
    );

    await waitFor(() => expect(apiRef.current).toBeTruthy());

    act(() => {
      apiRef.current.toggleLayer('bikeParking');
    });

    await waitFor(() => expect(loadInfrastructureData).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const l = apiRef.current.layers.bikeParking;
      expect(l.visible).toBe(true);
      expect(l.loaded).toBe(true);
      expect(l.loading).toBe(false);
    });

    // Map received source/layer
    expect(map.addSource).toHaveBeenCalled();
    expect(map.addLayer).toHaveBeenCalled();
    expect(getLayerStyle).toHaveBeenCalled();
  });

  it('clearFocus removes layers and resets layer states', async () => {
    const map = createMockMap();
    const initialLayers = {
      permitAreas: { visible: true },
      bikeParking: { visible: false, loaded: false, loading: false }
    };
    const apiRef = { current: null };

    render(
      <Harness
        map={map}
        focusedArea={focusedArea}
        initialLayers={initialLayers}
        onApi={(api) => { apiRef.current = api; }}
      />
    );

    await waitFor(() => expect(apiRef.current).toBeTruthy());

    act(() => {
      apiRef.current.toggleLayer('bikeParking');
    });
    await waitFor(() => expect(loadInfrastructureData).toHaveBeenCalled());

    act(() => {
      apiRef.current.clearFocus();
    });

    await waitFor(() => {
      const l = apiRef.current.layers.bikeParking;
      expect(l.visible).toBe(false);
      expect(l.loaded).toBe(false);
      expect(l.loading).toBe(false);
    });
  });
});


