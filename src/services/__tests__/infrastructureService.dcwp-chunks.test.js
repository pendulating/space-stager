import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { loadInfrastructureData } from '../infrastructureService.js';

const BOUNDS = [ [-74.006, 40.70], [-73.90, 40.80] ];

describe('infrastructureService dcwp multi-chunk footprints', () => {
  it('aggregates footprints across multiple chunk requests', async () => {
    // Return 205 rows with bins → expect 3 chunk fetches (100, 100, 5)
    const rows = Array.from({ length: 205 }, (_, i) => ({ bin: String(100000 + i), latitude: 40.75, longitude: -73.99, business_name: `G${i}`, detail: 'D' }));
    let chunkCalls = 0;
    server.use(
      http.get('https://data.cityofnewyork.us/resource/w7w3-xahh.json', () => {
        return HttpResponse.json(rows, { status: 200 });
      }),
      http.get('https://data.cityofnewyork.us/resource/5zhs-2jue.geojson', ({ request }) => {
        chunkCalls++;
        const url = new URL(request.url);
        const where = decodeURIComponent(url.searchParams.get('$where') || '');
        // Extract bins in this chunk and return one polygon per bin
        const m = where.match(/bin in\((.*)\)/);
        const list = m ? m[1].split(',').map(s => s.replace(/"/g, '').trim()) : [];
        const features = list.map((bin) => ({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [[[-73.99,40.75],[-73.99,40.751],[-73.98,40.751],[-73.98,40.75],[-73.99,40.75]]] },
          properties: { bin }
        }));
        return HttpResponse.json({ type: 'FeatureCollection', features }, { status: 200 });
      })
    );

    const data = await loadInfrastructureData('dcwpParkingGarages', BOUNDS);
    expect(chunkCalls).toBeGreaterThan(1);
    // One feature per BIN (polygons)
    expect(Array.isArray(data.features)).toBe(true);
    expect(data.features.length).toBe(205);
    expect(['Polygon','MultiPolygon']).toContain(data.features[0].geometry.type);
  });
});


