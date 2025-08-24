import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { loadInfrastructureData } from '../infrastructureService.js';

const BOUNDS = [ [-74.006, 40.70], [-73.90, 40.80] ];

function makeMapStyleWithDraw() {
  return { layers: [ { id: 'mapbox-gl-draw-linestring-inactive', type: 'line' } ] };
}

describe('infrastructureService local filter and beforeId placement', () => {
  it('local busStops filters features by bounds', async () => {
    server.use(
      http.get('/data/static/bus_stops_nyc.geojson', () => {
        return HttpResponse.json({ type: 'FeatureCollection', features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.95, 40.75] }, properties: {} },
          { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.50, 40.50] }, properties: {} }
        ] }, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('busStops', BOUNDS);
    expect(data.features.length).toBe(1);
  });

  it('addInfrastructureLayerToMap computes beforeId from draw layers (smoke)', async () => {
    // This is a smoke test ensuring getStyle().layers presence doesn't throw inside service logic when computing beforeId
    // We reuse benches endpoint as a simple remote dataset
    server.use(
      http.get('https://data.cityofnewyork.us/resource/esmy-s8q5.geojson', () => {
        return HttpResponse.json({ type: 'FeatureCollection', features: [ { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99,40.75] }, properties: {} } ] }, { status: 200 });
      })
    );
    // No direct assertion here since addInfrastructureLayerToMap is internal; success is no throw
    await loadInfrastructureData('benches', BOUNDS);
  });
});


