import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { importPlan } from '../importUtils.js';

// Helper to load example JSON
async function loadExampleJson(path) {
  const res = await fetch(path);
  return await res.json();
}

describe('importUtils examples: Brooklyn Birthday siteplan', () => {
  const origConfirm = global.confirm;
  const origFetch = global.fetch;

  beforeEach(() => {
    global.confirm = vi.fn(() => true);
    global.fetch = vi.fn(async (url) => {
      // Read from public/examples path by grabbing via import.meta (simulated)
      // For unit test, embed a minimal subset fixture of the provided JSON
      if (String(url).includes('/examples/brooklyn-birthday/siteplan.json')) {
        const json = {
          schemaVersion: 1,
          geography: { type: 'parks' },
          basemap: { key: 'satellite' },
          focusedArea: { system: 'B073-EVENTAREA-3227', name: 'Music Grove - Music Pagoda' },
          view: { center: { lng: -73.96700162151916, lat: 40.661829746176494 }, zoom: 19.58618430042473, bearing: 6.488207703404441, pitch: 60 },
          layers: {
            permitAreas: { visible: true, name: 'Zone', color: '#f97316' },
            bikeParking: { visible: true, enhancedRendering: { enabled: true, spriteBase: 'bike-rack' } },
            benches: { visible: true, name: 'Benches' }
          },
          customShapes: { type: 'FeatureCollection', features: [
            { id: 'shape-1', type: 'Feature', properties: { label: 'Tent location' }, geometry: { type: 'Polygon', coordinates: [[[-73.96696719942153,40.66206094488078],[-73.96683328590105,40.662002487147305],[-73.96689139931546,40.66190952966238],[-73.96703415618177,40.66196798747731],[-73.96696719942153,40.66206094488078]]] } }
          ] },
          droppedObjects: [
            {
              id: 'plastic-table-1757613587248',
              type: 'plastic-table',
              name: 'Plastic Table',
              position: { lng: -73.96666589399969, lat: 40.66197709155679 },
              properties: { rotationDeg: 90 },
              geometry: { type: 'Polygon', coordinates: [[[-73.96671,40.66195],[-73.96662,40.66195],[-73.96662,40.66200],[-73.96671,40.66200],[-73.96671,40.66195]]] }
            },
            {
              id: 'cooler-1757613636762',
              type: 'cooler',
              name: 'Cooler',
              position: { lng: -73.96666020899157, lat: 40.66184340519513 },
              properties: { rotationDeg: 270 }
            }
          ],
          eventInfo: { name: "Son's 4th Birthday Party", organizer: 'Mom', attendance: '40' }
        };
        return { ok: true, json: async () => json };
      }
      return { ok: false, json: async () => ({}) };
    });
  });

  afterEach(() => {
    global.confirm = origConfirm;
    global.fetch = origFetch;
  });

  function makeMap() {
    return {
      stop: vi.fn(),
      setCenter: vi.fn(), setZoom: vi.fn(), setBearing: vi.fn(), setPitch: vi.fn(),
      triggerRepaint: vi.fn(),
      once: (ev, cb) => { if (ev === 'moveend') cb(); },
      // Style guard methods used by importer
      isStyleLoaded: () => true,
      getStyle: () => ({ version: 8, layers: [] })
    };
  }

  it('imports example: sets geography, layers, event info, shapes and objects', async () => {
    const map = makeMap();
    const draw = { current: { set: vi.fn() } };
    const setLayers = vi.fn();
    const setDropped = vi.fn();

    const helpers = {
      setRehydratingImport: vi.fn(),
      wipeSlate: vi.fn(),
      selectGeography: vi.fn(),
      focusAreaByIdentity: vi.fn(() => true),
      reloadVisibleInfra: vi.fn(),
      setEventInfo: vi.fn(),
      // Minimal permit areas sync in examples open path
      waitForPermitAreasLoaded: vi.fn(async () => {}),
      waitForFocus: vi.fn(async () => true)
    };

    // Load the public example like the UI flow does
    const fileBlob = await (await fetch('/examples/brooklyn-birthday/siteplan.json')).json();
    const file = new File([JSON.stringify(fileBlob)], 'siteplan.json', { type: 'application/json' });

    importPlan(file, map, draw, null, setDropped, setLayers, helpers);

    await waitFor(() => {
      // Geography selected
      expect(helpers.selectGeography).toHaveBeenCalledWith('parks');
      // Focus attempted via identity
      expect(helpers.focusAreaByIdentity).toHaveBeenCalled();
      // Layers applied
      expect(setLayers).toHaveBeenCalled();
      // Custom shapes set into Draw
      expect(draw.current.set).toHaveBeenCalled();
      // Dropped objects normalized and set
      expect(setDropped).toHaveBeenCalled();
      const objs = setDropped.mock.calls[0][0];
      expect(Array.isArray(objs)).toBe(true);
      // Types preserved from example
      const types = objs.map(o => o.type).sort();
      expect(types).toContain('plastic-table');
      expect(types).toContain('cooler');
      // Positions present for both (derived or existing)
      objs.forEach(o => {
        expect(o.position && typeof o.position.lng === 'number' && typeof o.position.lat === 'number').toBe(true);
      });
      // Event info passed through
      expect(helpers.setEventInfo).toHaveBeenCalled();
    });
  }, 8000);

  it('derives position from rectangle geometry centroid when position missing', async () => {
    const map = makeMap();
    const draw = { current: { set: vi.fn() } };
    const setLayers = vi.fn();
    const setDropped = vi.fn();
    const helpers = { selectGeography: vi.fn(), focusAreaByIdentity: vi.fn(() => true) };

    const data = {
      schemaVersion: 1,
      geography: { type: 'parks' },
      focusedArea: { system: 'X' },
      layers: {}, customShapes: { type: 'FeatureCollection', features: [] },
      droppedObjects: [
        {
          id: 'rect-1', type: 'plastic-table', name: 'Plastic Table',
          // No position provided, but we include a rectangle geometry
          geometry: { type: 'Polygon', coordinates: [ [[0,0],[0.001,0],[0.001,0.001],[0,0.001],[0,0]] ] },
          properties: { rotationDeg: 0 }
        }
      ]
    };
    const file = new File([JSON.stringify(data)], 'plan.json', { type: 'application/json' });
    importPlan(file, map, draw, null, setDropped, setLayers, helpers);
    await waitFor(() => {
      const arr = setDropped.mock.calls[0][0];
      const obj = arr.find(o => o.id === 'rect-1');
      expect(obj).toBeTruthy();
      expect(obj.position && typeof obj.position.lng === 'number' && typeof obj.position.lat === 'number').toBe(true);
    });
  });
});
