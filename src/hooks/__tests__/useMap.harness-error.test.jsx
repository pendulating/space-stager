import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useMap } from '../useMap.js';

vi.mock('../../utils/mapUtils.js', () => ({
  loadMapLibraries: vi.fn(async () => {}),
  initializeMap: vi.fn()
}));

import { loadMapLibraries, initializeMap } from '../../utils/mapUtils.js';

function FlagsHarness() {
  const ref = React.useRef(null);
  const { map, mapLoaded, styleLoaded } = useMap(ref);
  return (
    <div>
      <div ref={ref} />
      <div data-testid="has-map">{String(!!map)}</div>
      <div data-testid="map-loaded">{String(mapLoaded)}</div>
      <div data-testid="style-loaded">{String(styleLoaded)}</div>
    </div>
  );
}

describe('useMap harness and error branches', () => {
  const origLocation = window.location.href;
  afterEach(() => {
    // reset URL
    window.history.pushState({}, '', origLocation);
    // cleanup harness markers
    const s = document.getElementById('test-harness-css');
    if (s && s.parentNode) s.parentNode.removeChild(s);
    // eslint-disable-next-line no-underscore-dangle
    if (window.__app) delete window.__app;
  });

  it('injects test harness CSS and helpers when ?testHarness is present', async () => {
    window.history.pushState({}, '', '?testHarness=1');
    let mapInstance;
    const handlers = {};
    const fakeMap = {
      _handlers: handlers,
      on: vi.fn((ev, cb) => { (handlers[ev] ||= []).push(cb); }),
      once: vi.fn((ev, cb) => { const wrap = (...a) => { fakeMap.off(ev, wrap); cb(...a); }; fakeMap.on(ev, wrap); }),
      off: vi.fn((ev, cb) => { handlers[ev] = (handlers[ev] || []).filter((h) => h !== cb); }),
      emit: (ev, e = {}) => { (handlers[ev] || []).forEach((cb) => cb(e)); },
      loaded: () => true,
      isStyleLoaded: () => true,
      areTilesLoaded: () => true,
      getLayoutProperty: vi.fn(),
      queryRenderedFeatures: vi.fn(() => []),
      jumpTo: vi.fn(),
      remove: vi.fn()
    };
    initializeMap.mockResolvedValueOnce((mapInstance = fakeMap));

    render(<FlagsHarness />);
    await act(async () => {});
    // Trigger load event to run initHarness
    fakeMap.emit('load');
    expect(document.getElementById('test-harness-css')).toBeTruthy();
    // eslint-disable-next-line no-underscore-dangle
    expect(window.__app && typeof window.__app.waitForIdle).toBe('function');
  });

  it('sets flags false when initializeMap throws', async () => {
    initializeMap.mockRejectedValueOnce(new Error('boom'));
    render(<FlagsHarness />);
    await act(async () => {});
    expect(screen.getByTestId('has-map').textContent).toBe('false');
    expect(screen.getByTestId('map-loaded').textContent).toBe('false');
    expect(screen.getByTestId('style-loaded').textContent).toBe('false');
  });

  it('calls remove() on unmount (cleanup)', async () => {
    const remove = vi.fn();
    const fakeMap = {
      on: vi.fn(),
      once: vi.fn(),
      loaded: () => false,
      isStyleLoaded: () => false,
      remove
    };
    initializeMap.mockResolvedValueOnce(fakeMap);
    const { unmount } = render(<FlagsHarness />);
    await act(async () => {});
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});


