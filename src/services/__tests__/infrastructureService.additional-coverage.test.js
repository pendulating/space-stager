import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { loadInfrastructureData, filterFeaturesByType, getLayerStyle } from '../infrastructureService.js';

const BOUNDS = [ [-74.006, 40.70], [-73.90, 40.80] ];

describe('infrastructureService additional coverage', () => {
  beforeEach(() => {
    // handlers reset in setupTests
  });

  it('bikeLanes URL uses intersects polygon filter', async () => {
    let capturedHref = null;
    server.use(
      http.get('https://data.cityofnewyork.us/resource/mzxg-pwib.geojson', ({ request }) => {
        capturedHref = request.url;
        return HttpResponse.json({ type: 'FeatureCollection', features: [] }, { status: 200 });
      })
    );
    await loadInfrastructureData('bikeLanes', BOUNDS);
    const url = new URL(capturedHref);
    const where = decodeURIComponent(url.searchParams.get('$where') || '');
    expect(where).toMatch(/intersects\(/);
  });

  it('linknycKiosks transforms JSON rows and adds computed props', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/s4kf-3yrf.json', () => {
        const rows = [
          { longitude: '-73.99', latitude: '40.75', link_site_id: 'L1', planned_kiosk_type: 'Type', link_installation_status: 'Active', street_address: '123 Main', cross_street_1: 'A', cross_street_2: 'B', boro: 'MN', neighborhood_tabulation_area_nta: 'NTA' }
        ];
        return HttpResponse.json(rows, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('linknycKiosks', BOUNDS);
    const p = data.features[0].properties;
    expect(p.kiosk_id).toBe('L1');
    expect(p.cross_streets).toBe('A & B');
  });

  it('dcwpParkingGarages with no BINs skips footprints fetch', async () => {
    let footprintsCalled = 0;
    server.use(
      http.get('https://data.cityofnewyork.us/resource/w7w3-xahh.json', () => {
        // Rows with no bin
        return HttpResponse.json([ { business_name: 'X', latitude: 40.7, longitude: -73.99 } ], { status: 200 });
      }),
      http.get('https://data.cityofnewyork.us/resource/5zhs-2jue.geojson', () => {
        footprintsCalled++;
        return HttpResponse.json({ type: 'FeatureCollection', features: [] }, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('dcwpParkingGarages', BOUNDS);
    expect(data.features).toHaveLength(0);
    expect(footprintsCalled).toBe(0);
  });

  it('filterFeaturesByType handles trees based on props and dbh', () => {
    const features = [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99,40.75] }, properties: { genusspecies: 'Acer' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99,40.75] }, properties: { dbh: 10 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99,40.75] }, properties: { note: 'big tree' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99,40.75] }, properties: { note: 'shrub' } }
    ];
    const out = filterFeaturesByType(features, 'trees');
    expect(out.length).toBe(3);
  });

  it('getLayerStyle returns fill for parkingLots and line for parksTrails', () => {
    const lots = getLayerStyle('parkingLots', { color: '#123' });
    const trails = getLayerStyle('parksTrails', { color: '#abc' });
    expect(lots.type).toBe('fill');
    expect(trails.type).toBe('line');
  });
});


