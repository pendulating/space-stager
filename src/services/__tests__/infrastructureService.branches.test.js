import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { loadInfrastructureData, filterFeaturesByType, getLayerStyle } from '../infrastructureService.js';

const BOUNDS = [ [-74.006, 40.70], [-73.90, 40.80] ];

describe('infrastructureService branches', () => {
  beforeEach(() => {
    // handlers reset is done by setupTests
  });

  it('streetParkingSigns converts EPSG:2263 x/y to lon/lat when lon/lat absent', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/nfid-uabd.json', () => {
        // Values around Midtown in EPSG:2263, roughly
        const rows = [
          { sign_x_coord: 987000, sign_y_coord: 212000, on_street: 'W 34 ST', sign_description: 'NO PARKING' },
          { sign_x_coord: 988000, sign_y_coord: 213000, on_street: '7 AV', sign_description: 'NO STANDING' }
        ];
        return HttpResponse.json(rows, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('streetParkingSigns', BOUNDS);
    expect(data.type).toBe('FeatureCollection');
    expect(data.features.length).toBeGreaterThan(0);
    // Valid coordinates should be within world bounds
    const [lon, lat] = data.features[0].geometry.coordinates;
    expect(Math.abs(lon)).toBeLessThanOrEqual(180);
    expect(Math.abs(lat)).toBeLessThanOrEqual(90);
  });

  it('accessiblePedSignals synthesizes Point geometry from properties', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/de3m-c5p4.geojson', () => {
        return HttpResponse.json({
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: null, properties: { point_x: -73.99, point_y: 40.75 } }
          ]
        }, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('accessiblePedSignals', BOUNDS);
    expect(data.features[0].geometry?.type).toBe('Point');
  });

  it('dcwpParkingGarages fetches footprints in chunks and outputs polygons', async () => {
    // First call returns a JSON array with many bins
    server.use(
      http.get('https://data.cityofnewyork.us/resource/w7w3-xahh.json', () => {
        const rows = Array.from({ length: 5 }, (_, i) => ({ bin: String(100000 + i), latitude: 40.75, longitude: -73.99, business_name: `G${i}` }));
        return HttpResponse.json(rows, { status: 200 });
      }),
      http.get('https://data.cityofnewyork.us/resource/5zhs-2jue.geojson', ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('$where')).toMatch(/bin in\(/);
        return HttpResponse.json({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [[[ -73.99,40.75],[-73.99,40.751],[-73.989,40.751],[-73.989,40.75],[-73.99,40.75 ]]] },
              properties: { bin: '100000' }
            }
          ]
        }, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('dcwpParkingGarages', BOUNDS);
    expect(data.type).toBe('FeatureCollection');
    expect(data.features.length).toBeGreaterThan(0);
    expect(['Polygon','MultiPolygon']).toContain(data.features[0].geometry.type);
  });

  it('stationEnvelopes intersects polygon branch during URL construction', async () => {
    let capturedHref = null;
    server.use(
      http.get('https://data.ny.gov/resource/vkng-7ivg.geojson', ({ request }) => {
        capturedHref = request.url;
        return HttpResponse.json({ type: 'FeatureCollection', features: [] }, { status: 200 });
      })
    );
    await loadInfrastructureData('stationEnvelopes', BOUNDS);
    const url = new URL(capturedHref);
    expect(url.searchParams.get('$where')).toMatch(/intersects\(/);
  });
});


