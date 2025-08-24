import { describe, it, expect, vi } from 'vitest';

vi.mock('../../utils/iconUtils.js', async (orig) => {
  // Provide empty icon set to force circle fallback
  const mod = await orig();
  return { ...mod, INFRASTRUCTURE_ICONS: {} };
});

import { getLayerStyle } from '../infrastructureService.js';

describe('getLayerStyle wide coverage', () => {
  const layers = [
    'hydrants','trees','busStops','benches','bikeParking','citibikeStations','subwayEntrances',
    'pedestrianRamps','drinkingFountains','publicRestrooms','sprayShowers','iceLadders','parksSigns'
  ];

  it('falls back to circle when icon defs missing', () => {
    layers.forEach((id) => {
      const style = getLayerStyle(id, { color: '#123456', enhancedRendering: { enabled: true } });
      // Some layers like bike lanes etc are line/fill; we only assert for symbol-capable ones in this set
      expect(['circle','symbol','line','fill']).toContain(style.type);
      if (['bikeLanes','parksTrails','parkingLots','dcwpParkingGarages','curbCuts'].includes(id)) return;
      if (style.type !== 'line' && style.type !== 'fill') {
        expect(style.type).toBe('circle');
      }
    });
  });

  it('default unknown layer without icon uses circle', () => {
    const style = getLayerStyle('unknown-layer', { color: '#eee' });
    expect(style.type).toBe('circle');
    expect(style.paint['circle-color']).toBe('#eee');
  });
});


