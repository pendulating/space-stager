import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import DroppedObjects from '../DroppedObjects.jsx';
import { DroppedObjectsProvider } from '../../../contexts/DroppedObjectsContext.jsx';

function makeMap() {
  const layers = [{ id: 'base-layer' }];
  const sources = new Map();
  const addSource = (id, def) => { sources.set(id, def); };
  let lastFc = null;
  const getSource = (id) => ({ setData: (fc) => { lastFc = fc; } });
  const map = {
    getStyle: () => ({ layers }),
    isStyleLoaded: () => true,
    addSource,
    getSource,
    hasImage: vi.fn((id) => id !== 'meter'),
    addImage: vi.fn(),
    getLayer: vi.fn(() => null),
    addLayer: vi.fn(),
    setFilter: vi.fn(),
    setPaintProperty: vi.fn(),
    setLayoutProperty: vi.fn(),
    moveLayer: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    project: ([lng, lat]) => ({ x: lng, y: lat }),
    __getLastFc: () => lastFc
  };
  return map;
}

describe('DroppedObjects branches', () => {
  let debugSpy;
  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    // Enable debug so debug.log calls are executed
    global.window = global.window || {};
    window.__DEBUG_DROPPED_OBJECTS__ = true;
  });
  afterEach(() => {
    debugSpy.mockRestore();
    try { delete window.__DEBUG_DROPPED_OBJECTS__; } catch (_) {}
  });

  it('builds features with correct icon properties for enhanced and static icons', async () => {
    const map = makeMap();
    const placeable = [
      { id: 'bike', geometryType: 'point', size: { width: 24, height: 24 }, enhancedRendering: { enabled: true, spriteBase: 'bike' } },
      { id: 'meter', geometryType: 'point', size: { width: 24, height: 24 }, imageUrl: '/images/meter.png' }
    ];
    const objects = [
      { id: 'o1', type: 'bike', position: { lng: -73.99, lat: 40.7 }, properties: { rotationDeg: 30 } },
      { id: 'o2', type: 'meter', position: { lng: -73.98, lat: 40.71 }, properties: {} }
    ];
    render(
      <DroppedObjectsProvider>
        <DroppedObjects map={map} objects={objects} placeableObjects={placeable} />
      </DroppedObjectsProvider>
    );
    // Allow ensure+rebuild timers to flush
    await new Promise(r => setTimeout(r, 10));
    const fc = map.__getLastFc();
    expect(fc && fc.features && fc.features.length).toBe(2);
    const f1 = fc.features.find(f => f.id === 'o1');
    const f2 = fc.features.find(f => f.id === 'o2');
    // Enhanced icon path: ready 1 and icon_image set
    expect(f1.properties.icon_ready).toBe(1);
    expect(typeof f1.properties.icon_image).toBe('string');
    // Static icon path: hasImage false => ready 0 and icon_image set to type id
    expect(f2.properties.icon_ready).toBe(0);
    expect(f2.properties.icon_image).toBe('meter');
    // Debug logging should have been called at least once
    expect(debugSpy).toHaveBeenCalled();
  });
});


