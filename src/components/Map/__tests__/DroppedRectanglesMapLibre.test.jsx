import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import DroppedRectanglesMapLibre from '../DroppedRectanglesMapLibre.jsx';

function makeMap() {
  const handlers = {};
  const layers = [];
  const sources = new Map();
  return {
    on: vi.fn((event, ...args) => { handlers[event] = handlers[event] || []; handlers[event].push(args[0]); }),
    off: vi.fn((event, ...args) => {}),
    once: vi.fn((event, cb) => { cb && cb(); }),
    getStyle: () => ({ layers }),
    isStyleLoaded: () => true,
    getLayer: vi.fn((id) => layers.find((l) => l.id === id)),
    addLayer: vi.fn((layerDef) => { layers.push(layerDef); }),
    removeLayer: vi.fn((id) => { const i = layers.findIndex((l) => l.id === id); if (i >= 0) layers.splice(i,1); }),
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
    queryRenderedFeatures: vi.fn(() => []),
    getSource: vi.fn((id) => sources.get(id)),
    addSource: vi.fn((id, def) => { sources.set(id, { _data: def.data, setData: vi.fn(function(d){ this._data = d; }) }); }),
    removeSource: vi.fn((id) => { sources.delete(id); }),
    setFeatureState: vi.fn(),
    getCanvas: () => ({ style: {} }),
    project: ([lng, lat]) => ({ x: (lng + 180) * 2, y: (90 - lat) * 2 }),
    unproject: ([x, y]) => ({ lng: x / 2 - 180, lat: 90 - y / 2 }),
    hasImage: () => false,
    addImage: vi.fn(),
  };
}

const rect = (id) => ({ id, type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } });

describe('DroppedRectanglesMapLibre', () => {
  beforeEach(() => { cleanup(); });

  it('initializes sources/layers and sets data on mount', () => {
    const map = makeMap();
    const objects = [ { id: 'r1', type: 'table', geometry: rect('r1').geometry } ];
    const placeableObjects = [ { id: 'table', geometryType: 'rect', color: '#123456' } ];
    render(<DroppedRectanglesMapLibre map={map} objects={objects} placeableObjects={placeableObjects} />);

    expect(map.addSource).toHaveBeenCalled();
    expect(map.addLayer).toHaveBeenCalled();
    // Source should receive a FeatureCollection with our rectangle
    const src = map.getSource('dropped-rectangles');
    expect(src).toBeDefined();
    expect(Array.isArray(src._data.features)).toBe(true);
    expect(src._data.features[0].properties).toEqual(expect.objectContaining({ id: 'r1', objectType: 'table' }));
  });

  it('updates handle/label sources when selectedId changes', () => {
    const map = makeMap();
    const objects = [ { id: 'r2', type: 'table', geometry: rect('r2').geometry } ];
    const placeableObjects = [ { id: 'table', geometryType: 'rect', color: '#123456' } ];
    const { rerender } = render(<DroppedRectanglesMapLibre map={map} objects={objects} placeableObjects={placeableObjects} selectedId={null} />);

    // Select rect -> handles populated
    rerender(<DroppedRectanglesMapLibre map={map} objects={objects} placeableObjects={placeableObjects} selectedId={'r2'} />);
    const handles = map.getSource('dropped-rectangles-handles');
    expect(handles && handles._data && Array.isArray(handles._data.features)).toBe(true);
    expect(handles._data.features.length).toBe(4);

    const labels = map.getSource('dropped-rectangles-labels');
    expect(labels && labels._data && Array.isArray(labels._data.features)).toBe(true);
    expect(labels._data.features.length).toBe(1);
  });

  it('cleans up layers and sources on unmount', () => {
    const map = makeMap();
    const objects = [ { id: 'r3', type: 'table', geometry: rect('r3').geometry } ];
    const placeableObjects = [ { id: 'table', geometryType: 'rect', color: '#123456' } ];
    const { unmount } = render(<DroppedRectanglesMapLibre map={map} objects={objects} placeableObjects={placeableObjects} />);
    unmount();
    // Sources removed
    expect(map.removeSource).toHaveBeenCalledWith('dropped-rectangles');
    expect(map.removeLayer).toHaveBeenCalled();
  });
});
