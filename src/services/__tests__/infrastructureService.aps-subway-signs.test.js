import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { loadInfrastructureData } from '../infrastructureService.js';

const BOUNDS = [ [-74.006, 40.70], [-73.90, 40.80] ];

describe('infrastructureService APS/Subway/Signs branches', () => {
  it('accessiblePedSignals synthesizes geometry from properties when missing', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/de3m-c5p4.geojson', () => {
        return HttpResponse.json({ type: 'FeatureCollection', features: [ { type: 'Feature', geometry: null, properties: { point_x: -73.99, point_y: 40.75 } } ] }, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('accessiblePedSignals', BOUNDS);
    expect(data.features[0].geometry.type).toBe('Point');
  });

  it('subwayEntrances features array builds geometry from entrance_longitude/latitude when needed', async () => {
    server.use(
      http.get('https://data.ny.gov/resource/i9wp-a4ja.geojson', () => {
        return HttpResponse.json({ type: 'FeatureCollection', features: [ { type: 'Feature', geometry: null, properties: { entrance_longitude: -73.98, entrance_latitude: 40.74 } } ] }, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('subwayEntrances', BOUNDS);
    expect(data.features[0].geometry.type).toBe('Point');
  });

  it('streetParkingSigns normalizes properties fields in FeatureCollection path', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/nfid-uabd.json', () => {
        return HttpResponse.json({ type: 'FeatureCollection', features: [ { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99,40.75] }, properties: { onstreet: 'Main', fromstreet: 'A', tostreet: 'B', side: 'N', sign_text: 'P' } } ] }, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('streetParkingSigns', BOUNDS);
    const p = data.features[0].properties;
    expect(p.on_street).toBe('Main');
    expect(p.from_street).toBe('A');
    expect(p.to_street).toBe('B');
    expect(p.side_of_street).toBe('N');
    expect(p.sign_description).toBe('P');
  });
});


