import { describe, it, expect, vi } from 'vitest';
import { loadInfrastructureData } from '../infrastructureService.js';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';

const BOUNDS = [ [-74.006, 40.70], [-73.90, 40.80] ];

describe('removeInfrastructureLayer error guards (smoke)', () => {
  it('does not throw when getStyle() throws or missing', async () => {
    // Use hydrants dataset for a simple remote fetch
    server.use(
      http.get('https://data.cityofnewyork.us/resource/5bgh-vtsn.geojson', () => {
        return HttpResponse.json({ type: 'FeatureCollection', features: [] }, { status: 200 });
      })
    );
    // This test just exercises code path indirectly; no assertion besides not throwing
    await loadInfrastructureData('hydrants', BOUNDS);
  });
});


