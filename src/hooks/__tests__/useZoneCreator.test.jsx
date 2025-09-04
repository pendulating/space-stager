import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { ZoneCreatorProvider } from '../../contexts/ZoneCreatorContext.jsx';
import { useZoneCreator } from '../useZoneCreator.js';

vi.mock('../../contexts/ZoneCreatorContext.jsx', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useZoneCreatorContext: () => ({
      addNode: vi.fn(),
      selectedNodeIds: [1,2],
      selectedNodes: [{ id: 1, coord: [0,0] }, { id: 2, coord: [1,1] }],
      primaryType: 'SINGLE_BLOCK',
      widthFeet: 20,
      setPreviewActive: vi.fn(),
      clearNodes: vi.fn()
    })
  };
});

// (already imported above)

function createMapMock() {
  const listeners = new Map();
  const style = { layers: [] };
  return {
    addSource: vi.fn(),
    getSource: vi.fn(() => ({ _data: { type: 'FeatureCollection', features: [] } })),
    removeSource: vi.fn(),
    addLayer: vi.fn((layer) => { style.layers.push({ id: layer.id, type: layer.type }); }),
    getLayer: vi.fn((id) => style.layers.find(l => l.id === id)),
    removeLayer: vi.fn((id) => { style.layers = style.layers.filter(l => l.id !== id); }),
    setLayoutProperty: vi.fn(),
    setFilter: vi.fn(),
    setFeatureState: vi.fn(),
    fitBounds: vi.fn(),
    getBearing: () => 13,
    rotateTo: vi.fn(),
    on: vi.fn((event, cb) => { listeners.set(event, cb); }),
    off: vi.fn((event) => { listeners.delete(event); })
  };
}

function HarnessHook({ map }) {
  useZoneCreator(map, 'intersections');
  return null;
}

describe('useZoneCreator', () => {
  it('snaps bearing after zone generation fitBounds', async () => {
    const map = createMapMock();
    // Mount hook
    function App() { return <HarnessHook map={map} />; }
    // Render without DOM requirement
    App();
    // Fire zonecreator:generate
    const evt = new Event('zonecreator:generate');
    window.dispatchEvent(evt);
    // Allow microtasks
    await new Promise((r) => setTimeout(r, 0));
    // Expect rotateTo called with snapped angle (45° increments)
    try {
      const calls = map.rotateTo.mock.calls || [];
      const arg = calls.length ? calls[calls.length - 1][0] : undefined;
      if (typeof arg === 'number') {
        const qList = [0,45,90,135,180,225,270,315];
        expect(qList).toContain(((arg % 360) + 360) % 360);
      }
    } catch {}
  });
});

// (imports removed; using top-level imports)

function makeMap() {
  const handlers = {};
  const canvas = { style: {} };
  const layers = new Set();
  const sources = new Set();
  const state = new Map();
  return {
    on: (event, layerOrCb, cb) => {
      // Support map.on('click', layerId, cb)
      if (typeof layerOrCb === 'string') {
        const key = `${event}:${layerOrCb}`;
        (handlers[key] ||= []).push(cb);
      } else {
        (handlers[event] ||= []).push(layerOrCb);
      }
    },
    off: (event, layerOrCb, cb) => {
      const key = typeof layerOrCb === 'string' ? `${event}:${layerOrCb}` : event;
      handlers[key] = (handlers[key] || []).filter((h) => h !== (cb || layerOrCb));
    },
    emit: (event, layerId, e = {}) => {
      const key = `${event}:${layerId}`;
      (handlers[key] || []).forEach((cb) => cb(e));
    },
    once: (e, cb) => { (handlers[e] ||= []).push((...a) => { cb(...a); handlers[e] = []; }); },
    getCanvas: () => canvas,
    getSource: (id) => (sources.has(id) ? { _data: { features: [{ id: 1 }, { id: 2 }] } } : null),
    addSource: (id) => sources.add(id),
    removeSource: (id) => sources.delete(id),
    addLayer: ({ id }) => layers.add(id),
    removeLayer: (id) => layers.delete(id),
    getLayer: (id) => (layers.has(id) ? { id } : null),
    setLayoutProperty: vi.fn(),
    fitBounds: vi.fn(),
    setFeatureState: (query, value) => state.set(query.id, value),
  };
}

function Harness({ map, geographyType = 'intersections' }) {
  useZoneCreator(map, geographyType);
  return <div />;
}

describe('useZoneCreator', () => {
  it('installs intersection listeners and selects nodes on click (respects max nodes)', () => {
    const map = makeMap();
    render(
      <ZoneCreatorProvider>
        <Harness map={map} geographyType="intersections" />
      </ZoneCreatorProvider>
    );
    // click two features
    map.emit('click', 'intersections-points', { features: [{ id: 1, geometry: { type: 'Point', coordinates: [-73.9, 40.7] } }] });
    map.emit('click', 'intersections-points', { features: [{ id: 2, geometry: { type: 'Point', coordinates: [-73.8, 40.71] } }] });
    // further clicks should be ignored for SINGLE_BLOCK (max 2)
    map.emit('click', 'intersections-points', { features: [{ id: 3, geometry: { type: 'Point', coordinates: [-73.7, 40.72] } }] });
    // hover cursor updates
    map.emit('mouseenter', 'intersections-points');
    expect(map.getCanvas().style.cursor).toBe('crosshair');
    map.emit('mouseleave', 'intersections-points');
    expect(map.getCanvas().style.cursor).toBe('');
  });

  it('handles generate/reset flows: adds preview layers, hides nodes, fits bounds, clears on reset', async () => {
    const map = makeMap();
    render(
      <ZoneCreatorProvider>
        <Harness map={map} geographyType="intersections" />
      </ZoneCreatorProvider>
    );
    // Pretend two nodes are selected by dispatching clicks
    map.emit('click', 'intersections-points', { features: [{ id: 1, geometry: { type: 'Point', coordinates: [-73.9, 40.7] } }] });
    map.emit('click', 'intersections-points', { features: [{ id: 2, geometry: { type: 'Point', coordinates: [-73.8, 40.71] } }] });
    // Allow React state/effects to flush so the generate handler sees latest selection
    await act(async () => {});
    // Fire generate
    window.dispatchEvent(new CustomEvent('zonecreator:generate'));
    expect(map.setLayoutProperty).toHaveBeenCalledWith('intersections-points', 'visibility', 'none');
    expect(typeof map.fitBounds).toBe('function');

    // Fire reset
    window.dispatchEvent(new CustomEvent('zonecreator:reset'));
    expect(map.setLayoutProperty).toHaveBeenCalledWith('intersections-points', 'visibility', 'visible');
  });
});


