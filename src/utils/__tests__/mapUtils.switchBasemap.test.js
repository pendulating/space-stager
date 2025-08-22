import { describe, it, expect, vi } from 'vitest';
import { switchBasemap } from '../mapUtils.js';
import { BASEMAP_OPTIONS } from '../../constants/mapConfig.js';

describe('mapUtils.switchBasemap (mocked map)', () => {
  const makeMockMap = () => {
    const calls = { setStyle: [], jumpTo: 0 };
    const state = {
      center: { lat: 40.75, lng: -73.99 },
      zoom: 12,
      bearing: 0,
      pitch: 0,
      currentCartoStyleUrl: ''
    };
    const events = new Map();
    const map = {
      __currentCartoStyleUrl: state.currentCartoStyleUrl,
      __currentBasemap: '',
      getCenter: () => state.center,
      getZoom: () => state.zoom,
      getBearing: () => state.bearing,
      getPitch: () => state.pitch,
      once: (name, handler) => { events.set(name, handler); },
      off: (name) => { events.delete(name); },
      setStyle: (url) => {
        calls.setStyle.push(url);
        const h = events.get('style.load');
        if (h) h();
      },
      jumpTo: () => { calls.jumpTo++; }
    };
    return { map, calls, state };
  };

  it('applies carto-dark style and resolves', async () => {
    const { map, calls } = makeMockMap();
    const darkUrl = BASEMAP_OPTIONS.carto.darkUrl;
    await expect(switchBasemap(map, 'carto-dark')).resolves.toBeUndefined();
    expect(calls.setStyle.at(-1)).toBe(darkUrl);
    expect(map.__currentBasemap).toBe('carto');
    expect(map.__currentCartoStyleUrl).toBe(darkUrl);
    expect(calls.jumpTo).toBeGreaterThan(0);
  });

  it('rejects unknown basemap key', async () => {
    const { map } = makeMockMap();
    await expect(switchBasemap(map, 'does-not-exist')).rejects.toThrow(/Unknown basemap/);
  });
});


