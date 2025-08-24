import { describe, it, expect } from 'vitest';
import { areIconsAvailable, filterFeaturesByType, getLayerStyle } from '../infrastructureService.js';
import { INFRASTRUCTURE_ICONS } from '../../utils/iconUtils.js';

describe('infrastructureService: filters and styles helpers', () => {
  it('filterFeaturesByType keeps only valid streetParkingSigns points', () => {
    const features = [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99, 40.75] }, properties: { sign_description: 'OK' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [999, 999] }, properties: {} }, // out of range
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-73.99,40.75],[-73.98,40.75]] }, properties: {} }
    ];
    const out = filterFeaturesByType(features, 'streetParkingSigns');
    expect(out.length).toBe(1);
    expect(out[0].geometry.type).toBe('Point');
  });

  it('filterFeaturesByType only allows line geometries for curbCuts', () => {
    const features = [
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-73.99,40.75],[-73.98,40.75]] }, properties: {} },
      { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [[[[-73.99,40.75],[-73.98,40.75]]]] }, properties: {} },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99, 40.75] }, properties: {} }
    ];
    const out = filterFeaturesByType(features, 'curbCuts');
    expect(out.length).toBe(2);
    expect(out.every(f => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString')).toBe(true);
  });

  it('filterFeaturesByType only keeps polygons for dcwpParkingGarages', () => {
    const features = [
      { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[-73.99,40.75],[-73.98,40.75],[-73.98,40.76],[-73.99,40.76],[-73.99,40.75]]] }, properties: {} },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.99, 40.75] }, properties: {} }
    ];
    const out = filterFeaturesByType(features, 'dcwpParkingGarages');
    expect(out.length).toBe(1);
    expect(out[0].geometry.type).toBe('Polygon');
  });

  it('areIconsAvailable returns true only when all icons are present on the map', () => {
    const allIds = Object.values(INFRASTRUCTURE_ICONS).map(i => i.id);
    const mapAll = { hasImage: (id) => allIds.includes(id) }; // always true for known ids
    expect(areIconsAvailable(mapAll)).toBe(true);

    const missingId = allIds[0];
    const mapSome = { hasImage: (id) => id !== missingId };
    expect(areIconsAvailable(mapSome)).toBe(false);
  });

  it('getLayerStyle returns expected style shapes for representative layers', () => {
    // curbCuts should be a line style with conditional color expression
    const curb = getLayerStyle('curbCuts', { color: '#ff0000' });
    expect(curb.type).toBe('line');
    expect(Array.isArray(curb.paint['line-color'])).toBe(true);
    expect(curb.paint['line-opacity']).toBeGreaterThan(0);

    // hydrants should be a symbol style when icons are defined
    const hyd = getLayerStyle('hydrants', { color: '#cc0000' });
    expect(['symbol','circle']).toContain(hyd.type);
    if (hyd.type === 'symbol') {
      expect(hyd.layout['icon-image']).toBeTruthy();
    } else {
      expect(hyd.paint['circle-color']).toBe('#cc0000');
    }
  });
});


