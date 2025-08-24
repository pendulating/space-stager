import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { loadInfrastructureData } from '../infrastructureService.js';

const BOUNDS = [ [-74.006, 40.70], [-73.90, 40.80] ];

describe('infrastructureService streetParkingSigns EPSG conversion', () => {
  it('converts sign_x/y EPSG:2263 to lon/lat and logs extent sanity', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/nfid-uabd.json', () => {
        const rows = [
          // values roughly in EPSG:2263 NYC range; exact conversion not asserted, only sane lon/lat
          { sign_x_coord: 987000, sign_y_coord: 212000, on_street: 'W 34 ST', sign_description: 'NO PARKING' },
          { sign_x_coord: 988000, sign_y_coord: 213000, on_street: '7 AV', sign_description: 'NO STANDING' }
        ];
        return HttpResponse.json(rows, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('streetParkingSigns', BOUNDS);
    expect(data.type).toBe('FeatureCollection');
    expect(data.features.length).toBeGreaterThan(0);
    const [lon, lat] = data.features[0].geometry.coordinates;
    expect(Math.abs(lon)).toBeLessThanOrEqual(180);
    expect(Math.abs(lat)).toBeLessThanOrEqual(90);
  });
});


