import { describe, it, expect } from 'vitest';
import { isPointInPolygon, isPointInFocusedArea, isFeatureVisibleOnMap, listBusStopsVisibleOnMap, listStreetParkingSignsVisibleOnMap, numberParkingFeaturesWithinArea, numberBusStopsWithinArea } from '../transitParkingUtils.js';

const squarePoly = {
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [[[-74,40.7],[-73.99,40.7],[-73.99,40.71],[-74,40.71],[-74,40.7]]] }
};

const offscreen = { project: ([lng, lat]) => ({ x: (lng + 180) * 2, y: (90 - lat) * 2 }) };
const mapPx = { width: 1000, height: 1000 };

describe('transitParkingUtils branches', () => {
  it('isPointInPolygon handles simple square', () => {
    expect(isPointInPolygon(-73.995, 40.705, squarePoly.geometry.coordinates[0])).toBe(true);
    expect(isPointInPolygon(-73.98, 40.72, squarePoly.geometry.coordinates[0])).toBe(false);
  });

  it('isPointInFocusedArea supports Polygon and MultiPolygon', () => {
    expect(isPointInFocusedArea(-73.995, 40.705, squarePoly)).toBe(true);
    const multi = { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: [squarePoly.geometry.coordinates] } };
    expect(isPointInFocusedArea(-73.995, 40.705, multi)).toBe(true);
  });

  it('isFeatureVisibleOnMap supports Point, LineString, MultiPolygon', () => {
    const pt = { geometry: { type: 'Point', coordinates: [-73.99, 40.7] } };
    const line = { geometry: { type: 'LineString', coordinates: [[-73.99,40.7],[-73.98,40.71]] } };
    const multiPoly = { geometry: { type: 'MultiPolygon', coordinates: [[[[-74,40.7],[-73.99,40.7],[-73.99,40.71],[-74,40.71],[-74,40.7]]]] } };
    expect(isFeatureVisibleOnMap(offscreen, mapPx, pt)).toBe(true);
    expect(isFeatureVisibleOnMap(offscreen, mapPx, line)).toBe(true);
    expect(isFeatureVisibleOnMap(offscreen, mapPx, multiPoly)).toBe(true);
  });

  it('list visible bus stops and parking signs and numbering functions', () => {
    const busStops = [ { geometry: { type: 'Point', coordinates: [-73.995, 40.705] }, properties: { stop_name: 'A'} } ];
    const signs = [ { geometry: { type: 'Point', coordinates: [-73.995, 40.705] }, properties: { on_street: 'Main'} } ];
    const visibleStops = listBusStopsVisibleOnMap(offscreen, mapPx, busStops);
    const visibleSigns = listStreetParkingSignsVisibleOnMap(offscreen, mapPx, signs);
    expect(visibleStops[0].index).toBe(1);
    expect(visibleSigns[0].index).toBe(1);

    const metersAsPoints = signs.map((s) => ({ geometry: s.geometry, properties: { on_street: 'Main' } }));
    const numberedMeters = numberParkingFeaturesWithinArea(metersAsPoints, squarePoly);
    expect(numberedMeters[0].index).toBe(1);
    const numberedStops = numberBusStopsWithinArea(busStops, squarePoly);
    expect(numberedStops[0].index).toBe(1);
  });
});


