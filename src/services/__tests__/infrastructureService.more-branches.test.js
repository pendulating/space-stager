import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { loadInfrastructureData, getLayerStyle } from '../infrastructureService.js';

const BOUNDS = [ [-74.006, 40.70], [-73.90, 40.80] ];

describe('infrastructureService additional branches', () => {
  it('parkingMeters normalizes geometry and properties', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/693u-uax6.geojson', () => {
        return HttpResponse.json({
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: null, properties: { on: 'Main', from: 'A', to: 'B', side_of_street: 'N', meterid: '123', status: 'OK', hours: '9-5', lat: '40.75', long: '-73.99' } }
          ]
        }, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('parkingMeters', BOUNDS);
    const f = data.features[0];
    expect(f.geometry?.type).toBe('Point');
    expect(f.properties.on_street).toBe('Main');
    expect(f.properties.from_street).toBe('A');
    expect(f.properties.to_street).toBe('B');
    expect(f.properties.meter_number).toBe('123');
    expect(f.properties.meter_hours).toBe('9-5');
  });

  it('streetParkingSigns FeatureCollection normalization maps property synonyms', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/nfid-uabd.json', () => {
        // Return FeatureCollection directly to hit secondary normalization branch
        return HttpResponse.json({
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99, 40.75] }, properties: { onstreet: 'Broadway', fromstreet: 'W 34', tostreet: 'W 35', side: 'N', sign_text: 'NO PARKING' } }
          ]
        }, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('streetParkingSigns', BOUNDS);
    const p = data.features[0].properties;
    expect(p.on_street).toBe('Broadway');
    expect(p.from_street).toBe('W 34');
    expect(p.to_street).toBe('W 35');
    expect(p.side_of_street).toBe('N');
    expect(p.sign_description).toBe('NO PARKING');
  });

  it('local dataset filters features by bounds', async () => {
    server.use(
      http.get('/data/static/bus_stops_nyc.geojson', () => {
        return HttpResponse.json({
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.95, 40.75] }, properties: {} }, // inside
            { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.50, 40.50] }, properties: {} } // outside
          ]
        }, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('busStops', BOUNDS);
    expect(data.features.length).toBe(1);
    expect(data.features[0].geometry.coordinates[0]).toBeCloseTo(-73.95, 2);
  });

  it('unknown layer throws', async () => {
    await expect(loadInfrastructureData('not-a-layer', BOUNDS)).rejects.toThrow(/Unknown layer/);
  });

  it('getLayerStyle uses coalesce when enhancedRendering is enabled for icon layers', () => {
    const style = getLayerStyle('hydrants', { color: '#f00', enhancedRendering: { enabled: true } });
    if (style.type === 'symbol') {
      expect(Array.isArray(style.layout['icon-image'])).toBe(true);
      expect(style.layout['icon-image'][0]).toBe('coalesce');
    }
  });

  it('getLayerStyle falls back to circle for unknown layer id', () => {
    const style = getLayerStyle('unknownLayerId', { color: '#123456' });
    expect(style.type).toBe('circle');
  });

  it('subwayEntrances handles JSON array fallback to FeatureCollection with Point geometry', async () => {
    server.use(
      http.get('https://data.ny.gov/resource/i9wp-a4ja.geojson', () => {
        return HttpResponse.json([
          { entrance_longitude: -73.99, entrance_latitude: 40.75, stop_name: 'S1' }
        ], { status: 200 });
      })
    );
    const data = await loadInfrastructureData('subwayEntrances', BOUNDS);
    expect(data.type).toBe('FeatureCollection');
    expect(data.features.length).toBe(1);
    expect(data.features[0].geometry.type).toBe('Point');
  });

  it('subwayEntrances features array builds Point geometry from entrance_longitude/latitude', async () => {
    server.use(
      http.get('https://data.ny.gov/resource/i9wp-a4ja.geojson', () => {
        return HttpResponse.json({
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: null, properties: { entrance_longitude: -73.98, entrance_latitude: 40.74 } }
          ]
        }, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('subwayEntrances', BOUNDS);
    expect(data.features[0].geometry.type).toBe('Point');
  });

  it('subwayEntrances deduplicates $select with geoField included', async () => {
    let capturedHref = null;
    server.use(
      http.get('https://data.ny.gov/resource/i9wp-a4ja.geojson', ({ request }) => {
        capturedHref = request.url;
        return HttpResponse.json({ type: 'FeatureCollection', features: [] }, { status: 200 });
      })
    );
    await loadInfrastructureData('subwayEntrances', BOUNDS);
    const url = new URL(capturedHref);
    const sel = decodeURIComponent(url.searchParams.get('$select') || '');
    const occurrences = (sel.match(/entrance_georeference/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it('fireLanes URL contains intersects() and filterField condition', async () => {
    let capturedHref = null;
    server.use(
      http.get('https://data.cityofnewyork.us/resource/inkn-q76z.geojson', ({ request }) => {
        capturedHref = request.url;
        return HttpResponse.json({ type: 'FeatureCollection', features: [] }, { status: 200 });
      })
    );
    await loadInfrastructureData('fireLanes', BOUNDS);
    const url = new URL(capturedHref);
    const where = decodeURIComponent(url.searchParams.get('$where') || '');
    expect(where).toMatch(/intersects\(/);
    expect(where).toMatch(/fire_lane='True'/);
  });

  it('specialDisasterRoutes URL contains intersects() and filterField condition', async () => {
    let capturedHref = null;
    server.use(
      http.get('https://data.cityofnewyork.us/resource/inkn-q76z.geojson', ({ request }) => {
        capturedHref = request.url;
        return HttpResponse.json({ type: 'FeatureCollection', features: [] }, { status: 200 });
      })
    );
    await loadInfrastructureData('specialDisasterRoutes', BOUNDS);
    const url = new URL(capturedHref);
    const where = decodeURIComponent(url.searchParams.get('$where') || '');
    expect(where).toMatch(/intersects\(/);
    expect(where).toMatch(/special_disaster='True'/);
  });

  it('getLayerStyle includes dasharray for fireLanes line style', () => {
    const style = getLayerStyle('fireLanes', { color: '#f00' });
    expect(style.type).toBe('line');
    expect(style.paint['line-dasharray']).toBeTruthy();
  });
});


