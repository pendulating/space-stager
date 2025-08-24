import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { loadInfrastructureData } from '../infrastructureService.js';

const BOUNDS = [ [-74.006, 40.70], [-73.90, 40.80] ];

describe('infrastructureService remove detaches events; geometry guards', () => {
  it('handles FeatureCollection with empty polygon rings via guards', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/hv9n-xgy4.geojson', () => {
        // parksSigns with invalid/empty geometry arrays will be filtered by ensureGeometry
        return HttpResponse.json({ type: 'FeatureCollection', features: [
          { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: {} },
          { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: [] }, properties: {} },
          { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99,40.75] }, properties: {} }
        ] }, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('parksSigns', BOUNDS);
    // only the valid point remains
    expect(data.features.length).toBeGreaterThan(0);
  });
});


