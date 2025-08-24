import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { loadInfrastructureData } from '../infrastructureService.js';

const BOUNDS = [ [-74.006, 40.70], [-73.90, 40.80] ];

describe('accessiblePedSignals filters invalid points', () => {
  it('removes entries without numeric coords when synthesizing geometry', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/de3m-c5p4.geojson', () => {
        return HttpResponse.json({ type: 'FeatureCollection', features: [
          { type: 'Feature', geometry: null, properties: { point_x: -73.99, point_y: 40.75 } },
          { type: 'Feature', geometry: null, properties: { point_x: '', point_y: '' } },
          { type: 'Feature', geometry: null, properties: { } }
        ] }, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('accessiblePedSignals', BOUNDS);
    expect(data.features.length).toBe(1);
    expect(data.features[0].geometry.type).toBe('Point');
  });
});


