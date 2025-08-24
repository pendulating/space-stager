import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { loadInfrastructureData } from '../infrastructureService.js';

const BOUNDS = [ [-74.006, 40.70], [-73.90, 40.80] ];

describe('infrastructureService curbCuts normalization', () => {
  it('maps SUB_FEATURE_CODE to curbcut_type', async () => {
    server.use(
      http.get('https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_Cut_2022/FeatureServer/5/query', () => {
        return HttpResponse.json({
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-73.99,40.75],[-73.98,40.75]] }, properties: { SUB_FEATURE_CODE: 222600 } },
            { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-73.99,40.76],[-73.98,40.76]] }, properties: { SUB_FEATURE_CODE: 222700 } },
            { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-73.99,40.77],[-73.98,40.77]] }, properties: { SUB_FEATURE_CODE: 0 } },
          ]
        }, { status: 200 });
      })
    );
    const data = await loadInfrastructureData('curbCuts', BOUNDS);
    const types = data.features.map(f => f.properties.curbcut_type);
    expect(types).toEqual(['midblock','corner','unknown']);
  });
});


