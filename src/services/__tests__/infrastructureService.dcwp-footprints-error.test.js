import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { loadInfrastructureData } from '../infrastructureService.js';

const BOUNDS = [ [-74.006, 40.70], [-73.90, 40.80] ];

describe('infrastructureService dcwp footprints error handling', () => {
  it('skips footprint chunk when secondary fetch not ok', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/w7w3-xahh.json', () => {
        const rows = [ { bin: '100001' }, { bin: '100002' } ];
        return HttpResponse.json(rows, { status: 200 });
      }),
      http.get('https://data.cityofnewyork.us/resource/5zhs-2jue.geojson', () => {
        return HttpResponse.text('error', { status: 500 });
      })
    );
    const data = await loadInfrastructureData('dcwpParkingGarages', BOUNDS);
    // With error on footprints, should produce empty features safely
    expect(Array.isArray(data.features)).toBe(true);
  });
});


