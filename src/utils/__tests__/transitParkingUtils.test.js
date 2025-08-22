import { describe, it, expect, vi } from 'vitest';
import {
  numberParkingFeaturesWithinArea,
  listSubwayStationsWithinArea,
  listBusStopsWithinArea,
  numberBusStopsWithinArea,
  isFeatureVisibleOnMap,
  listBusStopsVisibleOnMap,
  listStreetParkingSignsVisibleOnMap,
  listDcwpGaragesWithinMap
} from '../transitParkingUtils.js';

const focusedArea = {
  geometry: {
    type: 'Polygon',
    coordinates: [
      [[-74.01,40.70],[-74.01,40.80],[-73.90,40.80],[-73.90,40.70],[-74.01,40.70]]
    ]
  }
};

function offscreenMock(projectFn) {
  return { project: projectFn };
}

describe('transitParkingUtils', () => {
  it('numberParkingFeaturesWithinArea sorts and indexes', () => {
    const features = [
      { geometry: { type: 'Point', coordinates: [-74.0, 40.75] }, properties: { on_street: 'A', from_street: 'X' } },
      { geometry: { type: 'Point', coordinates: [-73.99, 40.751] }, properties: { on_street: 'A', from_street: 'W' } }
    ];
    const rows = numberParkingFeaturesWithinArea(features, focusedArea);
    expect(rows).toHaveLength(2);
    expect(rows[0].index).toBe(1);
  });

  it('listSubwayStationsWithinArea dedupes by name+routes and sorts', () => {
    const features = [
      { geometry: { type: 'Point', coordinates: [-74.0, 40.75] }, properties: { stop_name: 'Alpha', daytime_routes: 'A' } },
      { geometry: { type: 'Point', coordinates: [-74.0, 40.751] }, properties: { stop_name: 'Alpha', daytime_routes: 'A' } }
    ];
    const list = listSubwayStationsWithinArea(features, focusedArea);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Alpha');
  });

  it('listBusStopsWithinArea collects and dedupes by name+routes', () => {
    const features = [
      { geometry: { type: 'Point', coordinates: [-74.0, 40.75] }, properties: { stop_name: 'Stop', route_id: ['Q1','Q2'] } },
      { geometry: { type: 'Point', coordinates: [-74.0, 40.751] }, properties: { stop_name: 'Stop', route_id: ['Q2','Q1'] } }
    ];
    const list = listBusStopsWithinArea(features, focusedArea);
    expect(list).toHaveLength(1);
    expect(list[0].routes).toBe('Q1, Q2');
  });

  it('numberBusStopsWithinArea indexes after sort', () => {
    const features = [
      { geometry: { type: 'Point', coordinates: [-74.0, 40.75] }, properties: { stop_name: 'B' } },
      { geometry: { type: 'Point', coordinates: [-74.0, 40.751] }, properties: { stop_name: 'A' } }
    ];
    const list = numberBusStopsWithinArea(features, focusedArea);
    expect(list[0].index).toBe(1);
  });

  it('isFeatureVisibleOnMap tests point geometry projection bounds', () => {
    const off = offscreenMock((pt) => ({ x: 50, y: 50 }));
    const mapPx = { width: 100, height: 100 };
    const f = { geometry: { type: 'Point', coordinates: [-74, 40.7] } };
    expect(isFeatureVisibleOnMap(off, mapPx, f)).toBe(true);
  });

  it('listBusStopsVisibleOnMap returns sorted numbered items', () => {
    const off = offscreenMock((pt) => ({ x: 10, y: 10 }));
    const mapPx = { width: 100, height: 100 };
    const features = [
      { geometry: { type: 'Point', coordinates: [-74, 40.7] }, properties: { stop_name: 'B' } },
      { geometry: { type: 'Point', coordinates: [-74, 40.71] }, properties: { stop_name: 'A' } }
    ];
    const list = listBusStopsVisibleOnMap(off, mapPx, features);
    expect(list[0].index).toBe(1);
  });

  it('listStreetParkingSignsVisibleOnMap returns sorted numbered items', () => {
    const off = offscreenMock((pt) => ({ x: 10, y: 10 }));
    const mapPx = { width: 100, height: 100 };
    const features = [
      { geometry: { type: 'Point', coordinates: [-74, 40.7] }, properties: { on_street: 'A', from_street: 'X' } },
      { geometry: { type: 'Point', coordinates: [-74, 40.71] }, properties: { on_street: 'A', from_street: 'W' } }
    ];
    const list = listStreetParkingSignsVisibleOnMap(off, mapPx, features);
    expect(list[0].index).toBe(1);
  });

  it('listDcwpGaragesWithinMap collects visible features with fields', () => {
    const off = offscreenMock((pt) => ({ x: 10, y: 10 }));
    const mapPx = { width: 100, height: 100 };
    const features = [
      { geometry: { type: 'Point', coordinates: [-74, 40.7] }, properties: { business_name: 'G1', detail: 'D', address_building: '1', address_street_name: 'Main', address_street_name_2: '' } }
    ];
    const rows = listDcwpGaragesWithinMap(off, mapPx, features);
    expect(rows).toHaveLength(1);
    expect(rows[0].business_name).toBe('G1');
  });
});


