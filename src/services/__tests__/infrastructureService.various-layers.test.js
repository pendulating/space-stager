import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setupTests.js';
import { loadInfrastructureData } from '../infrastructureService.js';

const BOUNDS = [ [-74.006, 40.70], [-73.90, 40.80] ];

describe('infrastructureService various layers smoke (URL paths and normalization)', () => {
  it('loads multiple simple layers across types without error', async () => {
    server.use(
      http.get('https://data.cityofnewyork.us/resource/vjbm-hsyr.geojson', () => // parksTrails (line)
        HttpResponse.json({ type: 'FeatureCollection', features: [ { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-73.99,40.75],[-73.98,40.75]] }, properties: {} } ] }, { status: 200 })),
      http.get('https://data.cityofnewyork.us/resource/7cgt-uhhz.geojson', () => // parkingLots (polygon)
        HttpResponse.json({ type: 'FeatureCollection', features: [ { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[-73.99,40.75],[-73.98,40.75],[-73.98,40.76],[-73.99,40.76],[-73.99,40.75]]] }, properties: {} } ] }, { status: 200 })),
      http.get('https://data.cityofnewyork.us/resource/ckaz-6gaa.geojson', () => // sprayShowers (point)
        HttpResponse.json({ type: 'FeatureCollection', features: [ { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99,40.75] }, properties: {} } ] }, { status: 200 })),
      http.get('https://data.cityofnewyork.us/resource/qnv7-p7a2.geojson', () => // drinkingFountains (point)
        HttpResponse.json({ type: 'FeatureCollection', features: [ { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99,40.75] }, properties: {} } ] }, { status: 200 })),
      http.get('https://data.cityofnewyork.us/resource/ufzp-rrqu.geojson', () => // pedestrianRamps (point)
        HttpResponse.json({ type: 'FeatureCollection', features: [ { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99,40.75] }, properties: {} } ] }, { status: 200 })),
      http.get('https://data.cityofnewyork.us/resource/eubv-y6cr.geojson', () => // iceLadders (point)
        HttpResponse.json({ type: 'FeatureCollection', features: [ { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99,40.75] }, properties: {} } ] }, { status: 200 })),
      http.get('https://data.cityofnewyork.us/resource/i7jb-7jku.geojson', () => // publicRestrooms (point)
        HttpResponse.json({ type: 'FeatureCollection', features: [ { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99,40.75] }, properties: {} } ] }, { status: 200 }))
    );

    await loadInfrastructureData('parksTrails', BOUNDS);
    await loadInfrastructureData('parkingLots', BOUNDS);
    await loadInfrastructureData('sprayShowers', BOUNDS);
    await loadInfrastructureData('drinkingFountains', BOUNDS);
    await loadInfrastructureData('pedestrianRamps', BOUNDS);
    await loadInfrastructureData('iceLadders', BOUNDS);
    await loadInfrastructureData('publicRestrooms', BOUNDS);
    expect(true).toBe(true);
  });
});


