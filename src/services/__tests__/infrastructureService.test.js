import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { loadInfrastructureData } from '../infrastructureService.js';

const BOUNDS = [
  [-74.006, 40.70],
  [-73.90, 40.80]
];

describe('infrastructureService.loadInfrastructureData', () => {
  beforeEach(() => {
    // Reset handlers per-test
  });

  it('builds Socrata within_box query for bikeParking and returns GeoJSON', async () => {
    let capturedHref = null;
    server.use(
      http.get('https://data.cityofnewyork.us/resource/592z-n7dk.geojson', ({ request }) => {
        capturedHref = request.url;
        return HttpResponse.json({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99, 40.73] }, properties: {} }]
        }, { status: 200 });
      })
    );

    const data = await loadInfrastructureData('bikeParking', BOUNDS);
    expect(data?.type).toBe('FeatureCollection');
    expect(Array.isArray(data.features)).toBe(true);
    expect(data.features.length).toBe(1);
    expect(capturedHref).toBeTruthy();
    // should include $where with within_box and $limit
    const url = new URL(capturedHref);
    expect(url.searchParams.get('$where')).toMatch(/within_box\(/);
    expect(url.searchParams.get('$limit')).toBe('5000');
  });

  it('builds ArcGIS envelope query for curbCuts and returns GeoJSON', async () => {
    let capturedHref = null;
    server.use(
      http.get('https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_Cut_2022/FeatureServer/5/query', ({ request }) => {
        capturedHref = request.url;
        const url = new URL(capturedHref);
        expect(url.searchParams.get('geometryType')).toBe('esriGeometryEnvelope');
        expect(url.searchParams.get('f')).toBe('geojson');
        return HttpResponse.json({ type: 'FeatureCollection', features: [] }, { status: 200 });
      })
    );

    const data = await loadInfrastructureData('curbCuts', BOUNDS);
    expect(data?.type).toBe('FeatureCollection');
    expect(Array.isArray(data.features)).toBe(true);
  });

  it('normalizes streetParkingSigns JSON rows into GeoJSON FeatureCollection', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/nfid-uabd.json', () => {
        const rows = [
          { longitude: -73.985, latitude: 40.757, on_street: '7 AV', sign_description: 'NO PARKING' },
          { longitude: -73.99, latitude: 40.75, on_street: 'BROADWAY', sign_description: 'NO STANDING' }
        ];
        return HttpResponse.json(rows, { status: 200 });
      })
    );

    const data = await loadInfrastructureData('streetParkingSigns', BOUNDS);
    expect(data?.type).toBe('FeatureCollection');
    expect(Array.isArray(data.features)).toBe(true);
    expect(data.features.length).toBe(2);
    const first = data.features[0];
    expect(first.geometry?.type).toBe('Point');
    expect(first.properties).toBeTruthy();
  });

  it('handles local dataset (busStops) via absolute path handler', async () => {
    server.use(
      http.get('/data/static/bus_stops_nyc.geojson', () => {
        return HttpResponse.json({ type: 'FeatureCollection', features: [] }, { status: 200 });
      })
    );

    const data = await loadInfrastructureData('busStops', BOUNDS);
    expect(data?.type).toBe('FeatureCollection');
    expect(Array.isArray(data.features)).toBe(true);
  });

  it('throws on HTTP error for hydrants dataset', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/5bgh-vtsn.geojson', () => {
        return HttpResponse.text('server error', { status: 500 });
      })
    );

    await expect(loadInfrastructureData('hydrants', BOUNDS)).rejects.toThrow(/HTTP error/);
  });

  it('subwayEntrances uses within_box where clause', async () => {
    let capturedHref = null;
    server.use(
      http.get('https://data.ny.gov/resource/i9wp-a4ja.geojson', ({ request }) => {
        capturedHref = request.url;
        return HttpResponse.json({ type: 'FeatureCollection', features: [] }, { status: 200 });
      })
    );

    await loadInfrastructureData('subwayEntrances', BOUNDS);
    const url = new URL(capturedHref);
    const where = url.searchParams.get('$where') || '';
    expect(where).toMatch(/within_box\(/);
  });

  it('trees dataset uses within_box and returns empty FeatureCollection', async () => {
    let capturedHref = null;
    server.use(
      http.get('https://data.cityofnewyork.us/resource/hn5i-inap.geojson', ({ request }) => {
        capturedHref = request.url;
        return HttpResponse.json({ type: 'FeatureCollection', features: [] }, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('trees', BOUNDS);
    expect(data?.type).toBe('FeatureCollection');
    const url = new URL(capturedHref);
    expect(url.searchParams.get('$where')).toMatch(/within_box\(/);
  });

  it('parkingMeters uses within_box with the_geom field', async () => {
    let capturedHref = null;
    server.use(
      http.get('https://data.cityofnewyork.us/resource/693u-uax6.geojson', ({ request }) => {
        capturedHref = request.url;
        return HttpResponse.json({ type: 'FeatureCollection', features: [] }, { status: 200 });
      })
    );
    await loadInfrastructureData('parkingMeters', BOUNDS);
    const url = new URL(capturedHref);
    expect(url.searchParams.get('$where')).toMatch(/within_box\(/);
  });

  it('linknycKiosks transforms JSON rows into FeatureCollection', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/s4kf-3yrf.json', () => {
        const rows = [
          { location: { latitude: 40.75, longitude: -73.99 }, kiosk_id: 'A1' },
          { location: { latitude: 40.751, longitude: -73.991 }, kiosk_id: 'A2' }
        ];
        return HttpResponse.json(rows, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('linknycKiosks', BOUNDS);
    expect(data?.type).toBe('FeatureCollection');
    expect(Array.isArray(data.features)).toBe(true);
    expect(data.features.length).toBe(2);
  });

  it('rejects on 204 No Content (no JSON)', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/mzxg-pwib.geojson', () => {
        return new HttpResponse(null, { status: 204 });
      })
    );
    await expect(loadInfrastructureData('bikeLanes', BOUNDS)).rejects.toThrow();
  });

  it('handles 429 Too Many Requests gracefully (Retry-After)', async () => {
    let attempted = 0;
    server.use(
      http.get('https://data.cityofnewyork.us/resource/esmy-s8q5.geojson', () => {
        attempted++;
        return HttpResponse.text('rate limited', {
          status: 429,
          headers: { 'Retry-After': '1' }
        });
      })
    );
    await expect(loadInfrastructureData('benches', BOUNDS)).rejects.toThrow(/HTTP error/);
    expect(attempted).toBe(1);
  });
});


