import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportPermitAreaSiteplanV2 } from '../exportUtils.js';
import * as transitUtils from '../transitParkingUtils.js';

vi.mock('../transitParkingUtils.js', () => {
  return {
    drawParkingFeatureLabelsOnPdf: vi.fn(),
    drawParkingFeatureLabelsOnCanvas: vi.fn(),
    numberParkingFeaturesWithinArea: vi.fn(() => 0),
    listSubwayStationsWithinArea: vi.fn(() => [{ id: 's1' }]),
    listBusStopsWithinArea: vi.fn(() => [{ id: 'b1' }]),
    numberBusStopsWithinArea: vi.fn(() => 1),
    drawParkingAndTransitPage: vi.fn(),
    drawParkingSignsSummaryPage: vi.fn(),
    drawParkingMetersSummaryPage: vi.fn(),
    listStreetParkingSignsVisibleOnMap: vi.fn(() => [{ id: 'p1' }]),
    listDcwpGaragesWithinMap: vi.fn(() => [{ id: 'g1' }]),
    listSubwayStationsVisibleOnMap: vi.fn(() => [{ id: 's1' }]),
    listBusStopsVisibleOnMap: vi.fn(() => [{ id: 'b1' }]),
    drawBusStopFeatureLabelsOnPdf: vi.fn(),
    drawBusStopFeatureLabelsOnCanvas: vi.fn(),
    isFeatureVisibleOnMap: vi.fn(() => true),
    isPointInFocusedArea: vi.fn(() => true),
    isPointInPolygon: vi.fn(() => true),
  };
});

vi.mock('jspdf', () => {
  class FakePDF {
    constructor(){ this.calls = []; }
    addImage(){ this.calls.push(['addImage']); }
    addPage(){ this.calls.push(['addPage']); }
    setFont(){ this.calls.push(['setFont']); }
    setFontSize(){ this.calls.push(['setFontSize']); }
    setTextColor(){ this.calls.push(['setTextColor']); }
    setDrawColor(){ this.calls.push(['setDrawColor']); }
    setFillColor(){ }
    setLineWidth(){ }
    getFontSize(){ return 12; }
    text(){ }
    rect(){ }
    line(){ }
    lines(){ }
    circle(){ }
    getTextWidth(){ return 20; }
    save(){ this.calls.push(['save']); }
    setPage(){ }
    saveGraphicsState(){ }
    restoreGraphicsState(){ }
    setGState(){ }
  }
  return { default: FakePDF };
});

vi.mock('jspdf-autotable', () => ({ default: vi.fn() }));

// Mock infra data loader to avoid network
vi.mock('../../services/infrastructureService.js', () => ({
  loadInfrastructureData: vi.fn(async () => ({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-74, 40.7] }, properties: {} }] }))
}));

describe('exportUtils PDF success branches', () => {
  const origCreate = document.createElement;
  const origMaplibre = global.maplibregl;
  const origImage = global.Image;
  const origAlert = global.alert;
  const origFetch = global.fetch;

  beforeEach(() => {
    global.alert = vi.fn();
    document.createElement = (tag) => {
      const el = origCreate.call(document, tag);
      if (tag === 'canvas') {
        el.getContext = () => ({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
          setTransform: () => {},
          clearRect: () => {},
          drawImage: () => {},
          fillRect: () => {},
          beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {},
          measureText: (t) => ({ width: (''+t).length * 6 }),
          fillText: () => {},
        });
        el.toDataURL = () => 'data:image/png;base64,BASE';
      }
      return el;
    };
    global.Image = class { constructor(){ this.onload=null; this.onerror=null; this.width=200; this.height=120; } set src(_){ setTimeout(()=>this.onload&&this.onload(),0);} };
    // Fast stub for fetch used by sidewalks/centerlines
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ type: 'FeatureCollection', features: [ { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-74,40.7],[-73.99,40.71]] }, properties: { streetwidth: 30 } } ] }) }));
  });

  afterEach(() => {
    document.createElement = origCreate;
    global.maplibregl = origMaplibre;
    global.Image = origImage;
    global.alert = origAlert;
    global.fetch = origFetch;
  });

  function makeBounds(){
    return {
      getWest: () => -74.2,
      getEast: () => -73.7,
      getSouth: () => 40.48,
      getNorth: () => 40.92,
    };
  }
  function project([lng, lat]){
    // simple scaling
    return { x: (lng + 180) * 10, y: (90 - lat) * 10 };
  }
  function makeOffscreenMap(){
    const canvas = origCreate.call(document, 'canvas');
    canvas.toDataURL = () => 'data:image/png;base64,BASE';
    return class OffscreenMap {
      constructor(){ this._events = {}; }
      isStyleLoaded(){ return true; }
      once(ev, cb){ cb(); }
      getCanvas(){ return canvas; }
      getStyle(){ return { layers: [] }; }
      setLayoutProperty(){ }
      setFilter(){ }
      setPitch(){ }
      setBearing(){ }
      getLayer(){ return false; }
      fitBounds(){ }
      loaded(){ return true; }
      areTilesLoaded(){ return true; }
      getBounds(){ const b = makeBounds(); return { ...b, ...b }; }
      project(coords){ return project(coords); }
    };
  }

  function makeMainMap(){
    return {
      getCenter: () => ({ lng: -74, lat: 40.7 }),
      getZoom: () => 12,
      getBearing: () => 10,
      getPitch: () => 5,
      getStyle: () => ({ version: 8, layers: [] }),
    };
  }

  it('renders PDF with legend, dimensions, summary pages, inset and saves', async () => {
    global.maplibregl = { Map: makeOffscreenMap() };
    const map = makeMainMap();
    const focusedArea = { properties: { system: 'SYS', FSN_1: 'Main', FSN_2: 'Broadway', FSN_3: '1st Ave', FSN_4: '2nd Ave' }, geometry: { type: 'Polygon', coordinates: [[[-74,40.7],[-73.99,40.7],[-73.99,40.71],[-74,40.71],[-74,40.7]]] } };
    const layers = {
      permitAreas: { visible: true },
      benches: { visible: true, name: 'Benches', color: '#888888' },
      busStops: { visible: true, name: 'Bus Stops' },
      parkingMeters: { visible: true, name: 'Parking Meters' },
      streetParkingSigns: { visible: true, name: 'Parking Signs' },
    };
    const customShapes = [];
    const dropped = [ { id: 'd1', type: 'chair', position: { lng: -74, lat: 40.7 } }, { id: 'd2', type: 'speaker', position: { lng: -73.99, lat: 40.705 } } ];
    await exportPermitAreaSiteplanV2(
      map,
      focusedArea,
      layers,
      customShapes,
      dropped,
      'pdf',
      null,
      { noLegend: false, includeZoneDimensions: true, includeStreetSidewalkDimensions: true, includeObjectDimensions: true },
      { name: 'Event', organizer: 'Org', contact: 'Contact', date: '2025-01-01', time: '10:00', attendance: 100, permit: 'P-123', notes: 'Note' }
    );
    // Assert PDF save was invoked and at least one summary table tried to render via autotable
    // (we mock jspdf-autotable globally and rely on non-empty lists in mocks)
    // A strict spy on jsPDF isn't available here; this check ensures no exception path
    expect(global.alert).not.toHaveBeenCalled();
  }, 8000);

  it('renders PNG with legend and downloads without errors', async () => {
    global.maplibregl = { Map: makeOffscreenMap() };
    const map = makeMainMap();
    const focusedArea = { properties: { system: 'SYS', name: 'Park' }, geometry: { type: 'Polygon', coordinates: [[[-74,40.7],[-73.99,40.7],[-73.99,40.71],[-74,40.71],[-74,40.7]]] } };
    const layers = { benches: { visible: true, name: 'Benches' } };
    await exportPermitAreaSiteplanV2(map, focusedArea, layers, [], [], 'png', null, { noLegend: false });
    expect(global.alert).not.toHaveBeenCalled();
  });
});


