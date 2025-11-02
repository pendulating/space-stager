import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { switchBasemap } from '../mapUtils.js';
import { BASEMAP_OPTIONS } from '../../constants/mapConfig.js';

describe('mapUtils.switchBasemap', () => {
  function makeMap() {
    const handlers = {};
    return {
      getCenter: () => ({ lng: 0, lat: 0 }),
      getZoom: () => 16,
      getBearing: () => 0,
      getPitch: () => 0,
      setStyle: vi.fn(),
      jumpTo: vi.fn(),
      on: vi.fn((evt, cb) => { handlers[evt] = cb; }),
      off: vi.fn(),
      once: vi.fn(),
      addSource: vi.fn(),
      getSource: vi.fn(() => null),
      removeSource: vi.fn(),
      addLayer: vi.fn(),
      getLayer: vi.fn(() => null),
      removeLayer: vi.fn(),
      setLayoutProperty: vi.fn(),
      getLayoutProperty: vi.fn(() => 'visible'),
      getLayer: vi.fn(() => null),
      getSource: vi.fn(() => null),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
      setLayoutProperty: vi.fn(),
      getLayoutProperty: vi.fn(() => 'visible'),
      getStyle: () => ({ layers: [] }),
      loaded: () => true,
      areTilesLoaded: () => true,
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('switches to carto-dark and triggers style callback', async () => {
    const map = makeMap();
    const onStyleChange = vi.fn();
    // Synchronously fire style.load to resolve without timers
    map.once.mockImplementation((evt, cb) => { if (evt === 'style.load') cb && cb(); });
    await switchBasemap(map, 'carto-dark', onStyleChange);
    expect(onStyleChange).toHaveBeenCalledWith({ type: 'style' });
  });

  it('adds satellite overlay and triggers overlay callback', async () => {
    const map = makeMap();
    const onStyleChange = vi.fn();
    await switchBasemap(map, 'satellite', onStyleChange);
    await vi.runAllTimersAsync();
    expect(onStyleChange).toHaveBeenCalledWith({ type: 'overlay' });
  });

  it('restores carto and triggers callback after style.load', async () => {
    const map = makeMap();
    const onStyleChange = vi.fn();
    map.once.mockImplementation((evt, cb) => { if (evt === 'style.load') cb && cb(); });
    await switchBasemap(map, 'carto', onStyleChange);
    expect(onStyleChange).toHaveBeenCalled();
  });
});


