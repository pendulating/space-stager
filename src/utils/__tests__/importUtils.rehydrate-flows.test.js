import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { importPlan } from '../importUtils.js';

describe('importUtils rehydration flows', () => {
  const origConfirm = global.confirm;
  beforeEach(() => {
    global.confirm = vi.fn(() => true);
  });
  afterEach(() => {
    global.confirm = origConfirm;
  });

  function makeMap() {
    return {
      stop: vi.fn(),
      setCenter: vi.fn(), setZoom: vi.fn(), setBearing: vi.fn(), setPitch: vi.fn(),
      triggerRepaint: vi.fn(),
      once: (ev, cb) => { if (ev === 'moveend') cb(); },
      // interaction handlers
      scrollZoom: { disable: vi.fn(), enable: vi.fn() },
      boxZoom: { disable: vi.fn(), enable: vi.fn() },
      dragPan: { disable: vi.fn(), enable: vi.fn() },
      dragRotate: { disable: vi.fn(), enable: vi.fn() },
      keyboard: { disable: vi.fn(), enable: vi.fn() },
      doubleClickZoom: { disable: vi.fn(), enable: vi.fn() },
    };
  }

  it('applies subFocusArea geometry and awaits moveend, then restores layers and infra', async () => {
    const map = makeMap();
    const draw = { current: { set: vi.fn() } };
    const setLayers = vi.fn();
    const setDropped = vi.fn();
    const helpers = {
      setRehydratingImport: vi.fn(),
      wipeSlate: vi.fn(),
      selectGeography: vi.fn(),
      focusAreaByIdentity: vi.fn(),
      applySubFocus: vi.fn(() => true),
      onMoveEndOnce: (cb) => cb(),
      reloadVisibleInfra: vi.fn(),
      setEventInfo: vi.fn()
    };
    const data = {
      schemaVersion: 1,
      geography: { type: 'parks' },
      basemap: { key: 'carto-light' },
      focusedArea: { id: 'A' },
      subFocusArea: { geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } },
      layers: { benches: { visible: true } },
      customShapes: { type: 'FeatureCollection', features: [] },
      droppedObjects: []
    };
    const file = new File([JSON.stringify(data)], 'plan.json', { type: 'application/json' });
    importPlan(file, map, draw, null, setDropped, setLayers, helpers);
    await waitFor(() => {
      expect(helpers.setRehydratingImport).toHaveBeenCalledWith(true);
      expect(helpers.selectGeography).toHaveBeenCalledWith('parks');
      expect(helpers.applySubFocus).toHaveBeenCalled();
      expect(helpers.reloadVisibleInfra).toHaveBeenCalled();
      expect(helpers.setRehydratingImport).toHaveBeenLastCalledWith(false);
    });
  });

  it('emits rehydrating-import:end after completing import', async () => {
    const map = makeMap();
    const draw = { current: { set: vi.fn() } };
    const setLayers = vi.fn();
    const setDropped = vi.fn();
    const helpers = {
      setRehydratingImport: vi.fn(),
      wipeSlate: vi.fn(), selectGeography: vi.fn(),
      applySubFocus: vi.fn(() => true),
      onMoveEndOnce: (cb) => cb(),
      reloadVisibleInfra: vi.fn(), setEventInfo: vi.fn()
    };
    const data = {
      schemaVersion: 1,
      geography: { type: 'parks' },
      focusedArea: { id: 'A' },
      subFocusArea: { geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } },
      layers: {}, customShapes: { type: 'FeatureCollection', features: [] }, droppedObjects: []
    };
    const events = [];
    const handler = () => { events.push('end'); };
    window.addEventListener('rehydrating-import:end', handler);
    const file = new File([JSON.stringify(data)], 'plan.json', { type: 'application/json' });
    importPlan(file, map, draw, null, setDropped, setLayers, helpers);
    await waitFor(() => {
      expect(events.includes('end')).toBe(true);
    });
    window.removeEventListener('rehydrating-import:end', handler);
  });

  it('focuses by geometry fallback when id/system missing', async () => {
    const map = makeMap();
    const draw = { current: { set: vi.fn() } };
    const setLayers = vi.fn();
    const setDropped = vi.fn();
    const helpers = {
      setRehydratingImport: vi.fn(),
      wipeSlate: vi.fn(),
      selectGeography: vi.fn(),
      focusAreaByIdentity: vi.fn(),
      focusAreaByGeometry: vi.fn(),
      setEventInfo: vi.fn()
    };
    const data = {
      schemaVersion: 1,
      geography: { type: 'parks' },
      focusedArea: { geometry: { type: 'Point', coordinates: [-74, 40.7] } },
      layers: {}, customShapes: { type: 'FeatureCollection', features: [] }, droppedObjects: []
    };
    const file = new File([JSON.stringify(data)], 'plan.json', { type: 'application/json' });
    importPlan(file, map, draw, null, setDropped, setLayers, helpers);
    await waitFor(() => {
      expect(helpers.focusAreaByIdentity).not.toHaveBeenCalled();
      expect(helpers.focusAreaByGeometry).toHaveBeenCalled();
    });
  });

  it('handles invalid JSON and does not throw', async () => {
    const map = makeMap();
    const draw = { current: { set: vi.fn() } };
    const setLayers = vi.fn();
    const setDropped = vi.fn();
    const file = new File(["{ invalid json"], 'bad.json', { type: 'application/json' });
    expect(() => importPlan(file, map, draw, null, setDropped, setLayers, {})).not.toThrow();
  });

  it('defers applying view until waitForFocus resolves, then applies snapped bearing', async () => {
    const map = makeMap();
    const draw = { current: { set: vi.fn() } };
    const setLayers = vi.fn();
    const setDropped = vi.fn();
    let resolveFocus;
    const waitForFocus = vi.fn(() => new Promise((res) => { resolveFocus = res; }));
    const helpers = {
      setRehydratingImport: vi.fn(),
      wipeSlate: vi.fn(),
      selectGeography: vi.fn(),
      focusAreaByIdentity: vi.fn(() => true),
      waitForPermitAreasLoaded: vi.fn(async () => {}),
      waitForFocus
    };
    const focusedArea = { system: 'SYS', id: 'X', geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } };
    const data = {
      schemaVersion: 1,
      geography: { type: 'parks' },
      focusedArea,
      view: { center: { lng: -73.99, lat: 40.75 }, zoom: 14, bearing: 10, pitch: 0 },
      layers: {}, customShapes: { type: 'FeatureCollection', features: [] }, droppedObjects: []
    };
    const file = new File([JSON.stringify(data)], 'plan.json', { type: 'application/json' });
    importPlan(file, map, draw, null, setDropped, setLayers, helpers);
    // Wait until the importer requests focus readiness
    await waitFor(() => { expect(waitForFocus).toHaveBeenCalled(); });
    // Bearing should not be applied yet because waitForFocus not resolved
    expect(map.setBearing).not.toHaveBeenCalled();
    // Resolve focus readiness now
    resolveFocus && resolveFocus(true);
    await waitFor(() => {
      expect(waitForFocus).toHaveBeenCalled();
      expect(map.setPitch).toHaveBeenCalledWith(0);
      // Bearing is quantized to 45° slices centered at 22.5°
      const b = map.setBearing.mock.calls[0][0];
      const mod = (((b - 22.5) % 45) + 45) % 45;
      expect(mod).toBeCloseTo(0, 5);
    });
  });
});


