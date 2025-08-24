import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { loadInfrastructureData } from '../infrastructureService.js';

const BOUNDS = [ [-74.006, 40.70], [-73.90, 40.80] ];

describe('subwayEntrances JSON array with missing coords', () => {
  it('filters items missing coordinates when array shape returned', async () => {
    server.use(
      http.get('https://data.ny.gov/resource/i9wp-a4ja.geojson', () => {
        return HttpResponse.json([
          { entrance_longitude: -73.99, entrance_latitude: 40.75, stop_name: 'OK' },
          { entrance_longitude: '', entrance_latitude: '', stop_name: 'BAD' }
        ], { status: 200 });
      })
    );
    const data = await loadInfrastructureData('subwayEntrances', BOUNDS);
    expect(data.features.length).toBe(1);
    expect(data.features[0].geometry.type).toBe('Point');
  });
});


