import { describe, it, expect, vi } from 'vitest';
import { getMetersPerPixel, getSafeFilename, createNYCBasemapStyle } from '../mapUtils.js';

describe('mapUtils (pure parts)', () => {
  it('getMetersPerPixel uses zoom and center lat', () => {
    const map = {
      getZoom: () => 12,
      getCenter: () => ({ lat: 40.75, lng: -73.99 })
    };
    const mpp = getMetersPerPixel(map);
    expect(typeof mpp).toBe('number');
    expect(mpp).toBeGreaterThan(0);
  });

  it('getSafeFilename normalizes and appends date', () => {
    const out = getSafeFilename('My Test/Plan v1');
    expect(out).toMatch(/^my-test-plan-v1-\d{4}-\d{2}-\d{2}$/);
  });

  it('createNYCBasemapStyle builds a valid style for 2018', () => {
    const style = createNYCBasemapStyle('2018');
    expect(style?.version).toBe(8);
    expect(style?.sources?.['nyc-satellite']).toBeTruthy();
    expect(style?.layers?.some(l => l.id === 'nyc-satellite-layer')).toBe(true);
  });
});


