import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initializeMap } from '../mapUtils.js';

function makeWindowMaplibre() {
  const events = {};
  const mapInstance = {
    on: vi.fn((ev, cb) => { events[ev] = cb; }),
    getContainer: vi.fn(() => ({ querySelector: () => null, appendChild: () => {} })),
    addControl: vi.fn(),
  };
  const Map = vi.fn(() => mapInstance);
  return { Map, mapInstance, events };
}

describe('initializeMap dark/light style', () => {
  const originalLocalStorage = global.localStorage;
  const storage = new Map();
  beforeEach(() => {
    // Stub localStorage
    // minimal interface used: getItem, setItem
    global.localStorage = {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, v),
    };
    // stub matchMedia
    global.window.matchMedia = () => ({ matches: false });
  });
  afterEach(() => {
    storage.clear?.();
    global.localStorage = originalLocalStorage;
  });

  it('uses carto dark when theme is dark', async () => {
    const { Map, mapInstance, events } = makeWindowMaplibre();
    global.window.maplibregl = { Map, NavigationControl: vi.fn(), ScaleControl: vi.fn() };
    // set dark theme
    localStorage.setItem('theme', 'dark');
    const p = initializeMap(document.createElement('div'));
    events['load']?.();
    await expect(p).resolves.toBe(mapInstance);
    const args = Map.mock.calls[0][0];
    expect(typeof args.style).toBe('string');
    expect(args.style).toMatch(/dark-matter-gl-style\/style\.json/);
  });
});
