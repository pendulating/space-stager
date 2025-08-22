import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { exportPlan, importPlan, exportPermitAreaSiteplanV2 } from '../exportUtils.js';

describe('exportUtils export/import flows', () => {
  const origCreate = document.createElement;
  const origURL = global.URL;
  const origAlert = global.alert;
  const origMaplibre = global.maplibregl;

  beforeEach(() => {
    // Anchor download harness
    const clicks = [];
    const fakeUrl = { created: [], createObjectURL: (b) => { const u = 'blob:fake'; fakeUrl.created.push(b); return u; }, revokeObjectURL: vi.fn() };
    global.URL = fakeUrl;
    document.createElement = (tag) => {
      const el = origCreate.call(document, tag);
      if (tag === 'a') {
        el.click = () => { clicks.push({ href: el.href, download: el.download }); };
      }
      if (tag === 'canvas') {
        el.getContext = () => ({
          imageSmoothingEnabled: true,
          setTransform: () => {},
          clearRect: () => {},
          drawImage: () => {},
          fillRect: () => {},
          beginPath: () => {},
          arc: () => {},
          fill: () => {},
          stroke: () => {},
        });
        el.toDataURL = () => 'data:image/png;base64,BASE';
        el.toBlob = (cb) => cb(new Blob(['x'], { type: 'image/png' }));
      }
      return el;
    };
    // Expose clicks for assertions
    // @ts-ignore
    document.__clicks = clicks;
    global.alert = vi.fn();
  });
  afterEach(() => {
    document.createElement = origCreate;
    global.URL = origURL;
    global.alert = origAlert;
    global.maplibregl = origMaplibre;
  });

  function makeMap() {
    return {
      getCenter: () => ({ lng: -74, lat: 40.7 }),
      getZoom: () => 12,
      getBearing: () => 15,
      getPitch: () => 20,
      setCenter: vi.fn(), setZoom: vi.fn(), setBearing: vi.fn(), setPitch: vi.fn(),
      getStyle: () => ({ version: 8, layers: [] })
    };
  }

  it('exportPlan creates a downloadable JSON with expected fields', () => {
    const map = makeMap();
    const draw = { current: { getAll: () => ({ type: 'FeatureCollection', features: [{ id: '1' }] }) } };
    const layers = { permitAreas: { visible: true } };
    const dropped = [{ type: 'chair' }];
    const focusedArea = { id: 'fa1', properties: { system: 'SYS', name: 'Union Park' }, geometry: { type: 'Point', coordinates: [-74, 40.7] } };
    exportPlan(map, draw, dropped, layers, [], { geographyType: 'parks', focusedArea, appVersion: '1.2.3' });
    // @ts-ignore
    const clicks = document.__clicks;
    expect(clicks.length).toBe(1);
    expect(clicks[0].download).toMatch(/siteplan-\d{4}-\d{2}-\d{2}\.json/);
  });

  it('importPlan restores view, layers, shapes and dropped objects from v1 schema', async () => {
    const map = makeMap();
    const draw = { current: { set: vi.fn() } };
    const setLayers = vi.fn();
    const setDropped = vi.fn();
    const helpers = { selectGeography: vi.fn(), focusAreaByIdentity: vi.fn() };
    const data = {
      schemaVersion: 1,
      basemap: { key: 'carto-light' },
      geography: { type: 'parks' },
      focusedArea: { system: 'SYS', id: 'X' },
      view: { center: { lng: -73.99, lat: 40.75 }, zoom: 14, bearing: 10, pitch: 5 },
      layers: { benches: { visible: true } },
      customShapes: { type: 'FeatureCollection', features: [] },
      droppedObjects: [{ type: 'chair' }]
    };
    const file = new File([JSON.stringify(data)], 'plan.json', { type: 'application/json' });
    importPlan(file, map, draw, null, setDropped, setLayers, helpers);
    await waitFor(() => {
      expect(setLayers).toHaveBeenCalled();
      expect(setDropped).toHaveBeenCalledWith([{ type: 'chair' }]);
      expect(map.setCenter).toHaveBeenCalledWith({ lng: -73.99, lat: 40.75 });
      expect(map.setZoom).toHaveBeenCalledWith(14);
      expect(map.setBearing).toHaveBeenCalledWith(10);
      expect(map.setPitch).toHaveBeenCalledWith(5);
      expect(draw.current.set).toHaveBeenCalled();
      expect(helpers.selectGeography).toHaveBeenCalledWith('parks');
      expect(helpers.focusAreaByIdentity).toHaveBeenCalledWith({ type: 'parks', system: 'SYS', id: 'X' });
    });
  });

  it('exportPermitAreaSiteplanV2 supports PNG flow and downloads a file', async () => {
    // Minimal MapLibre offscreen mock
    const canvas = origCreate.call(document, 'canvas');
    canvas.getContext = () => ({
      imageSmoothingEnabled: true,
      setTransform: () => {},
      clearRect: () => {},
      drawImage: () => {},
      fillRect: () => {},
      beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {},
    });
    canvas.toDataURL = () => 'data:image/png;base64,BASE';
    global.maplibregl = {
      Map: class {
        constructor(){ this._events = {}; }
        getCanvas(){ return canvas; }
        isStyleLoaded(){ return true; }
        areTilesLoaded(){ return true; }
        once(ev, cb){ cb(); }
        fitBounds(){ }
        getStyle(){ return { layers: [] }; }
        setLayoutProperty(){ }
        setFilter(){ }
        setPitch(){ }
        setBearing(){ }
        getLayer(){ return false; }
        loaded(){ return true; }
      }
    };

    // Image loader for inset and icon preloads
    global.Image = class { constructor(){ this.onload=null; this.onerror=null; this.width=100; this.height=50; } set src(_){ setTimeout(()=>this.onload&&this.onload(),0);} };

    const map = makeMap();
    const focusedArea = { properties: { system: 'SYS', name: 'Union Park' }, geometry: { type: 'Polygon', coordinates: [[[-74,40.7],[-73.95,40.7],[-73.95,40.72],[-74,40.72],[-74,40.7]]] } };
    const layers = { permitAreas: { visible: true } };
    await exportPermitAreaSiteplanV2(map, focusedArea, layers, [], [], 'png', null, { noLegend: true });
    // @ts-ignore
    const clicks = document.__clicks;
    expect(clicks.some(c => /\.png$/.test(c.download))).toBe(true);
  });
});


