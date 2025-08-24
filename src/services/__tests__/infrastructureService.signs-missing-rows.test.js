import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { loadInfrastructureData } from '../infrastructureService.js';

const BOUNDS = [ [-74.006, 40.70], [-73.90, 40.80] ];

describe('streetParkingSigns array path with missing rows filtering', () => {
  it('filters out rows without usable coordinates', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/nfid-uabd.json', () => {
        const rows = [
          { longitude: -73.985, latitude: 40.757, on_street: '7 AV' },
          { sign_x_coord: 987000, sign_y_coord: 212000, on_street: 'W 34 ST' },
          { on_street: 'No Coords' },
          { longitude: '', latitude: '' }
        ];
        return HttpResponse.json(rows, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('streetParkingSigns', BOUNDS);
    expect(data.type).toBe('FeatureCollection');
    // Only two valid geometry rows should remain
    expect(data.features.length).toBe(2);
  });
});


