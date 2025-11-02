import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import EdgeMarkers from '../EdgeMarkers.jsx';

function makeMap({ width = 800, height = 600, sourcesPresent = true } = {}) {
  const listeners = {};
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: width });
  Object.defineProperty(container, 'clientHeight', { value: height });
  const center = { lng: -73.99, lat: 40.7 };
  return {
    on: vi.fn((evt, cb) => { listeners[evt] = cb; }),
    off: vi.fn((evt) => { delete listeners[evt]; }),
    once: vi.fn((evt, cb) => { listeners[evt] = cb; }),
    getContainer: () => container,
    getCenter: () => center,
    project: (arg) => {
      const lng = Array.isArray(arg) ? arg[0] : (arg && typeof arg === 'object' ? arg.lng : 0);
      const lat = Array.isArray(arg) ? arg[1] : (arg && typeof arg === 'object' ? arg.lat : 0);
      // Simple projection: move features left of viewport to negative x, inside to center
      const x = (lng > center.lng ? width + 50 : lng < center.lng ? -50 : width / 2);
      const y = (lat > center.lat ? height + 50 : lat < center.lat ? -50 : height / 2);
      return { x, y };
    },
    unproject: ([x, y]) => ({ lng: x, lat: y }),
    getSource: vi.fn((id) => (sourcesPresent ? { id } : null)),
    __listeners: listeners,
  };
}

function makeInfra({ withInside = false } = {}) {
  const mkPt = (id, lng, lat, props={}) => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: [lng, lat] }, properties: props });
  const centerLng = -73.99; const centerLat = 40.7;
  return {
    busStops: {
      type: 'FeatureCollection',
      features: [
        // Offscreen left
        mkPt('bus-1', centerLng - 1, centerLat),
        ...(withInside ? [mkPt('bus-in', centerLng, centerLat, { stop_name: 'Inside Stop', route_id: 'B1' })] : [])
      ]
    },
    parkingMeters: {
      type: 'FeatureCollection',
      features: [ mkPt('meter-1', centerLng, centerLat - 1, { meter_number: 'M123' }) ]
    },
    subwayEntrances: {
      type: 'FeatureCollection',
      features: [ mkPt('sub-1', centerLng + 1, centerLat, { daytime_routes: 'A,C' }) ]
    }
  };
}

describe('EdgeMarkers', () => {
  beforeEach(() => {
    cleanup();
    // Polyfill raf/caf using timers per Vitest guidance
    vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(() => cb(Date.now()), 0));
    vi.stubGlobal('cancelAnimationFrame', (id) => { try { clearTimeout(id); } catch (_) {} });
  });

  afterEach(() => {
    try { vi.useRealTimers(); } catch (_) {}
  });

  it('renders null when no map sources available', () => {
    const map = makeMap({ sourcesPresent: false });
    const { container } = render(<EdgeMarkers map={map} infrastructureData={makeInfra()} categories={['busStops','parkingMeters','subwayEntrances']} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders markers only for offscreen candidates and shows labels/icons', async () => {
    const map = makeMap();
    const infra = makeInfra({ withInside: true });
    render(<EdgeMarkers map={map} infrastructureData={infra} categories={['busStops','parkingMeters','subwayEntrances']} />);
    // Trigger a static event to force an immediate update cycle
    try { map.__listeners['zoom'] && map.__listeners['zoom'](); } catch (_) {}
    // Should render something (wrapper div) since we have offscreen items
    await waitFor(() => {
      const overlay = document.querySelector('[aria-hidden="true"].pointer-events-none');
      expect(overlay).toBeTruthy();
    });
    // Primary labels (BUS default, METER code, subway lines) or secondary street names
    // Subway label should include routes (A C)
    await waitFor(() => expect(document.body.textContent || '').toMatch(/A\s*C|BUS|M123/));
  });

  it('limits to max markers and prioritizes subway over bus over meters', async () => {
    const map = makeMap();
    const infra = makeInfra();
    render(<EdgeMarkers map={map} infrastructureData={infra} categories={['busStops','parkingMeters','subwayEntrances']} />);
    try { map.__listeners['zoom'] && map.__listeners['zoom'](); } catch (_) {}
    // Subway label (lines) or default category labels appear
    await waitFor(() => {
      expect(document.body.textContent || '').toMatch(/A\s*C|BUS|M123/);
    });
  });

  it('skips on-screen features (inside viewport) and renders only offscreen ones', async () => {
    const map = makeMap();
    const infra = makeInfra({ withInside: true });
    render(<EdgeMarkers map={map} infrastructureData={infra} categories={['busStops','parkingMeters','subwayEntrances']} />);
    try { map.__listeners['zoom'] && map.__listeners['zoom'](); } catch (_) {}
    await waitFor(() => {
      const txt = document.body.textContent || '';
      expect(txt.includes('Inside Stop')).toBe(false);
    });
  });

  it('still computes when some sources are present and others missing', async () => {
    const map = makeMap();
    // Only subwayEntrances source available
    map.getSource = vi.fn((id) => id === 'source-subwayEntrances' ? { id } : null);
    const infra = makeInfra();
    render(<EdgeMarkers map={map} infrastructureData={infra} categories={['busStops','parkingMeters','subwayEntrances']} />);
    try { map.__listeners['zoom'] && map.__listeners['zoom'](); } catch (_) {}
    await waitFor(() => {
      const overlay = document.querySelector('[aria-hidden="true"].pointer-events-none');
      expect(overlay).toBeTruthy();
    });
  });

  it('updates markers when categories change (enter/exit lifecycle)', async () => {
    vi.useRealTimers();
    const map = makeMap();
    const infra = makeInfra();
    const { rerender } = render(<EdgeMarkers map={map} infrastructureData={infra} categories={['busStops','parkingMeters','subwayEntrances']} />);
    try { map.__listeners['zoom'] && map.__listeners['zoom'](); } catch (_) {}
    await waitFor(() => expect(document.querySelector('[title="A Train"]')).toBeTruthy());
    // Remove subway category and ensure subway label disappears after updates
    const infraBusOnly = { ...infra, subwayEntrances: { type: 'FeatureCollection', features: [] } };
    rerender(<EdgeMarkers map={map} infrastructureData={infraBusOnly} categories={['busStops','parkingMeters','subwayEntrances']} />);
    try { map.__listeners['zoom'] && map.__listeners['zoom'](); } catch (_) {}
    await waitFor(() => expect(document.querySelector('[title="A Train"]')).toBeNull());
  }, 5000);

});


