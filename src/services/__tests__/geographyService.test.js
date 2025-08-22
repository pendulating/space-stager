import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { loadPolygonAreas, loadPointAreas, unloadGeographyLayers } from '../geographyService.js';

function createMockMap() {
  const sources = new Map();
  const layers = new Map();
  const style = { layers: [ { id: 'symbol-0', type: 'symbol' } ] };
  const canvas = { style: { cursor: '' } };
  const events = new Map();

  const map = {
    getStyle: () => style,
    loaded: () => true,
    isStyleLoaded: () => true,
    getCanvas: () => canvas,
    addSource: vi.fn((id, src) => { sources.set(id, { ...src, setData: vi.fn() }); }),
    getSource: vi.fn((id) => sources.get(id)),
    removeSource: vi.fn((id) => { sources.delete(id); }),
    isSourceLoaded: vi.fn((id) => sources.has(id)),
    addLayer: vi.fn((layer, beforeId) => { layers.set(layer.id, { ...layer, beforeId }); style.layers.push({ id: layer.id, type: layer.type }); }),
    getLayer: vi.fn((id) => layers.get(id)),
    removeLayer: vi.fn((id) => { layers.delete(id); }),
    moveLayer: vi.fn(),
    setLayoutProperty: vi.fn(),
    on: vi.fn((evt, handler) => {
      events.set(evt, handler);
      // fire idle immediately for tests
      if (evt === 'idle') setTimeout(handler, 0);
    }),
    off: vi.fn((evt) => { events.delete(evt); })
  };
  return map;
}

describe('geographyService', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('loadPolygonAreas loads data, adds layers, and returns features', async () => {
    const url = 'https://example.test/polygons.geojson';
    server.use(
      http.get(url, () => HttpResponse.json({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { id: 'a' }, geometry: { type: 'Polygon', coordinates: [[[0,0],[0,1],[1,1],[1,0],[0,0]]] } }
        ]
      }))
    );

    const map = createMockMap();
    const res = await loadPolygonAreas(map, { idPrefix: 'permit-areas', url });
    expect(res.features.length).toBe(1);
    expect(map.addSource).toHaveBeenCalled();
    expect(map.addLayer).toHaveBeenCalled();
    // layers exist
    expect(map.getLayer('permit-areas-fill')).toBeTruthy();
    expect(map.getLayer('permit-areas-outline')).toBeTruthy();
    expect(map.getLayer('permit-areas-focused-fill')).toBeTruthy();
    expect(map.getLayer('permit-areas-focused-outline')).toBeTruthy();
  });

  it('loadPointAreas loads data, adds circle layers, and returns features', async () => {
    const url = 'https://example.test/points.geojson';
    server.use(
      http.get(url, () => HttpResponse.json({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { id: 'p' }, geometry: { type: 'Point', coordinates: [0,0] } }
        ]
      }))
    );

    const map = createMockMap();
    const res = await loadPointAreas(map, { idPrefix: 'intersections', url });
    expect(res.features.length).toBe(1);
    expect(map.getLayer('intersections-points')).toBeTruthy();
    expect(map.getLayer('intersections-focused-points')).toBeTruthy();
  });

  it('unloadGeographyLayers removes layers and source', () => {
    const map = createMockMap();
    // pre-seed layers and source
    map.addSource('x', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'x-points', type: 'circle', source: 'x' });
    map.addLayer({ id: 'x-focused-points', type: 'circle', source: 'x' });
    map.addLayer({ id: 'x-fill', type: 'fill', source: 'x' });
    map.addLayer({ id: 'x-outline', type: 'line', source: 'x' });
    map.addLayer({ id: 'x-focused-fill', type: 'fill', source: 'x' });
    map.addLayer({ id: 'x-focused-outline', type: 'line', source: 'x' });

    unloadGeographyLayers(map, 'x');
    expect(map.getLayer('x-points')).toBeUndefined();
    expect(map.getSource('x')).toBeUndefined();
  });

  it('loadPolygonAreas retries and throws on repeated HTTP errors', async () => {
    vi.useFakeTimers();
    const url = 'https://example.test/polygons-500.geojson';
    server.use(http.get(url, () => new HttpResponse('boom', { status: 500 })));
    const map = createMockMap();
    const p = loadPolygonAreas(map, { idPrefix: 'err', url });
    // attach catch early to avoid unhandled rejection noise
    const guarded = p.catch(() => {});
    // speed through retry delays (500 + 1000 + 2000 + 4000 ms)
    // advance enough time for all scheduled backoffs
    await vi.advanceTimersByTimeAsync(8000);
    await expect(p).rejects.toThrow();
    await guarded;
    vi.useRealTimers();
  });
});


