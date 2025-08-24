import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportPermitAreaSiteplanV2 } from '../exportUtils.js';

describe('exportUtils PNG legend on canvas', () => {
  const origCreate = document.createElement;
  const origImage = global.Image;
  const origURL = global.URL;
  const origMaplibre = global.maplibregl;

  beforeEach(() => {
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
          beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {},
          measureText: (t) => ({ width: t?.length || 0 }),
          textAlign: 'left', textBaseline: 'alphabetic', font: '12px Arial',
          fillText: () => {}, strokeRect: () => {}
        });
        el.toDataURL = () => 'data:image/png;base64,BASE';
        el.toBlob = (cb) => cb(new Blob(['x'], { type: 'image/png' }));
      }
      return el;
    };
    // Expose clicks for assertions
    // @ts-ignore
    document.__clicks = clicks;
    // Make images load immediately (legend icons, inset, etc.)
    global.Image = class { constructor(){ this.onload=null; this.onerror=null; this.width=100; this.height=50; } set src(_){ setTimeout(()=>this.onload&&this.onload(),0);} };
    // Minimal offscreen map
    const canvas = origCreate.call(document, 'canvas');
    canvas.getContext = () => ({ imageSmoothingEnabled: true, setTransform: () => {}, clearRect: () => {}, drawImage: () => {} });
    canvas.toDataURL = () => 'data:image/png;base64,BASE';
    global.maplibregl = {
      Map: class {
        getCanvas(){ return canvas; }
        isStyleLoaded(){ return true; }
        areTilesLoaded(){ return true; }
        once(_e, cb){ cb(); }
        fitBounds(){}
        getStyle(){ return { layers: [] }; }
        setLayoutProperty(){}
        setFilter(){}
        setPitch(){}
        setBearing(){}
        getLayer(){ return false; }
        loaded(){ return true; }
      }
    };
  });

  afterEach(() => {
    document.createElement = origCreate;
    global.Image = origImage;
    global.URL = origURL;
    global.maplibregl = origMaplibre;
  });

  function makeMap() {
    return {
      getCenter: () => ({ lng: -74, lat: 40.7 }),
      getZoom: () => 13,
      getBearing: () => 0,
      getPitch: () => 0,
      setCenter: vi.fn(), setZoom: vi.fn(), setBearing: vi.fn(), setPitch: vi.fn(),
      getStyle: () => ({ version: 8, layers: [] })
    };
  }

  it('invokes PNG flow with legend (noLegend=false) and downloads image', async () => {
    const map = makeMap();
    const focusedArea = { properties: { system: 'SYS', name: 'Union Park' }, geometry: { type: 'Polygon', coordinates: [[[-74,40.7],[-73.99,40.7],[-73.99,40.71],[-74,40.71],[-74,40.7]]] } };
    const layers = { permitAreas: { visible: true }, benches: { visible: true, name: 'Benches', color: '#333' } };
    const customShapes = [
      { geometry: { type: 'Point', coordinates: [-74, 40.705] }, properties: { label: 'A' } }
    ];
    await exportPermitAreaSiteplanV2(map, focusedArea, layers, customShapes, [], 'png', null, { noLegend: false });
    // @ts-ignore
    const clicks = document.__clicks;
    expect(clicks.length).toBe(1);
    expect(clicks[0].download).toMatch(/\.png$/);
  });
});


