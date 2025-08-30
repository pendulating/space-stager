import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { usePermitAreas } from '../usePermitAreas.js';

// MapLibre best practices referenced via Context7 docs:
// - Use layer-bound mousemove/mouseleave for hover show/hide
// - Fallback to map-level mousemove + queryRenderedFeatures([x,y])
// - Hide on interaction starts (dragstart/zoomstart/etc)
// - Avoid DOM overlay interference via pointer-events:none; validate on 'render'

vi.mock('../../services/permitAreaService', () => ({
  searchPermitAreas: (areas, q) => areas,
  highlightOverlappingAreas: vi.fn(),
  clearOverlapHighlights: vi.fn()
}));

vi.mock('../../services/geographyLayerManager', () => ({
  ensureBaseLayers: vi.fn(), setBaseVisibility: vi.fn(), unload: vi.fn()
}));

vi.mock('../../services/geographyService', () => ({
  loadPolygonAreas: vi.fn(async () => ({ type: 'FeatureCollection', features: [] })),
  loadPointAreas: vi.fn(async () => ({ type: 'FeatureCollection', features: [] }))
}));

vi.mock('../../contexts/ZoneCreatorContext.jsx', () => ({
  useZoneCreatorContext: () => null
}));

function makeMap() {
  const style = { layers: [
    { id: 'permit-areas-fill', type: 'fill' },
    { id: 'permit-areas-focused-fill', type: 'fill' },
    { id: 'plaza-areas-fill', type: 'fill' },
    { id: 'intersections-points', type: 'circle' },
    { id: 'intersections-focused-points', type: 'circle' }
  ]};
  const listeners = new Map();
  const on = vi.fn((ev, layerOrCb, maybeCb) => {
    const key = maybeCb ? `${ev}:${layerOrCb}` : ev;
    const cb = maybeCb || layerOrCb;
    listeners.set(key, cb);
  });
  const off = vi.fn((ev, layerOrCb, maybeCb) => {
    const key = maybeCb ? `${ev}:${layerOrCb}` : ev;
    listeners.delete(key);
  });
  const once = vi.fn((ev, layerOrCb, maybeCb) => {
    const key = maybeCb ? `${ev}:${layerOrCb}` : ev;
    const cb = maybeCb || layerOrCb;
    cb();
    listeners.delete(key);
  });
  const trigger = (ev, layer, e) => {
    const cb = listeners.get(`${ev}:${layer}`) || listeners.get(ev);
    if (cb) cb(e || {});
  };
  // DOM container + canvas for doc-level move tests
  const container = document.createElement('div');
  container.className = 'map-container';
  // Position container at (100,100) to test clientX/Y → map pixel conversion
  container.getBoundingClientRect = () => ({ left: 100, top: 100, right: 900, bottom: 700, width: 800, height: 600 });
  document.body.appendChild(container);
  const canvas = document.createElement('canvas');
  canvas.className = 'map-canvas';
  container.appendChild(canvas);

  let qrfImpl = vi.fn(() => []);
  const m = {
    loaded: () => true,
    isStyleLoaded: () => true,
    getStyle: () => style,
    addSource: vi.fn(),
    addLayer: vi.fn((l) => { style.layers.push({ id: l.id, type: l.type }); }),
    getLayer: vi.fn((id) => style.layers.find((l) => l.id === id)),
    removeLayer: vi.fn((id) => { style.layers = style.layers.filter((l) => l.id !== id); }),
    setFilter: vi.fn(),
    setLayoutProperty: vi.fn(),
    getLayoutProperty: vi.fn(() => 'visible'),
    queryRenderedFeatures: vi.fn((pt, opts) => qrfImpl(pt, opts)),
    getCanvas: () => canvas,
    getCanvasContainer: () => container,
    getControl: vi.fn(() => null),
    on, off, once,
    __trigger: trigger,
    __setQueryRenderedFeatures: (fn) => { qrfImpl = fn; }
  };
  return m;
}

function Harness({ map, mode = 'parks' }) {
  const hook = usePermitAreas(map, true, { mode });
  React.useEffect(() => { try { hook.loadPermitAreas && hook.loadPermitAreas(); } catch (_) {} }, []);
  // Render minimal state for assertions
  return (
    <div>
      <div data-testid="vis">{hook.tooltip?.visible ? '1' : '0'}</div>
      <div data-testid="content">{Array.isArray(hook.tooltip?.content) ? hook.tooltip.content.map(f => `${f.label}:${f.value}`).join('|') : ''}</div>
      <div data-testid="clicked">{hook.clickedTooltip?.visible ? '1' : '0'}</div>
    </div>
  );
}

describe('usePermitAreas tooltip behavior', () => {
  beforeEach(() => {
    // Clean body to avoid interference across tests
    document.body.innerHTML = '';
  });

  it('shows hover tooltip on mousemove over fill with properties, hides on mouseleave', async () => {
    const map = makeMap();
    render(<Harness map={map} mode="parks" />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    // Simulate hover with feature
    map.__trigger('mousemove', 'permit-areas-fill', { point: { x: 120, y: 130 }, features: [{ properties: { name: 'Central Park' } }] });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('1'));
    await waitFor(() => expect(screen.getByTestId('content').textContent).toMatch(/Name:Central Park/));
    // Mouseleave should hide
    map.__trigger('mouseleave', 'permit-areas-fill', {});
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('0'));
  });

  it('hides on map-level mousemove when no features at pointer', async () => {
    const map = makeMap();
    render(<Harness map={map} mode="parks" />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    // First show tooltip
    map.__trigger('mousemove', 'permit-areas-fill', { point: { x: 150, y: 160 }, features: [{ properties: { name: 'Prospect Park' } }] });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('1'));
    // Now map-level move with no hits should hide
    map.__setQueryRenderedFeatures(() => []);
    map.__trigger('mousemove', undefined, { point: { x: 151, y: 161 } });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('0'));
  });

  it('hides when overlays intercept pointer (document mousemove target not canvas)', async () => {
    const map = makeMap();
    render(<Harness map={map} mode="parks" />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    // Show tooltip first
    map.__trigger('mousemove', 'permit-areas-fill', { point: { x: 200, y: 210 }, features: [{ properties: { name: 'Bryant Park' } }] });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('1'));
    // Dispatch a mousemove whose target is an overlay inside the container (not the canvas)
    const container = map.getCanvasContainer();
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    container.appendChild(overlay);
    overlay.dispatchEvent(new MouseEvent('mousemove', { clientX: 220, clientY: 230, bubbles: true }));
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('0'));
  });

  it('hides on interaction starts (dragstart)', async () => {
    const map = makeMap();
    render(<Harness map={map} mode="parks" />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    map.__trigger('mousemove', 'permit-areas-fill', { point: { x: 260, y: 270 }, features: [{ properties: { name: 'Union Sq' } }] });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('1'));
    map.__trigger('dragstart');
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('0'));
  });

  it('does not show hover tooltip while drawing mode is active', async () => {
    const map = makeMap();
    // Simulate draw control active (non-simple_select)
    map.getControl = vi.fn(() => ({ getMode: () => 'draw_polygon' }));
    render(<Harness map={map} mode="parks" />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    map.__trigger('mousemove', 'permit-areas-fill', { point: { x: 300, y: 310 }, features: [{ properties: { name: 'Riverside' } }] });
    expect(screen.getByTestId('vis').textContent).toBe('0');
  });

  it('suppresses hover tooltip when clicked popover is visible (parks click)', async () => {
    const map = makeMap();
    render(<Harness map={map} mode="parks" />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    // Click to open clicked popover: return no annotation hits, and one feature for permit-areas-fill
    map.queryRenderedFeatures = vi.fn((pt, opts) => {
      const layers = (opts && opts.layers) || [];
      if (layers.includes('annotation-text') || layers.includes('annotation-arrows') || layers.includes('annotation-arrowheads')) {
        return [];
      }
      if (layers.includes('permit-areas-fill')) {
        return [{ properties: { name: 'Pelham Bay', system: 'SYS1' }, geometry: { type: 'Polygon', coordinates: [[[0,0],[0,1],[1,1],[1,0],[0,0]]] } }];
      }
      return [];
    });
    map.__trigger('click', 'permit-areas-fill', { point: { x: 340, y: 350 }, features: [{ properties: { name: 'Pelham Bay' } }], lngLat: { lng: -73.8, lat: 40.8 } });
    await waitFor(() => expect(screen.getByTestId('clicked').textContent).toBe('1'));
    // Move should not show hover tooltip while clicked popover is visible
    map.__trigger('mousemove', 'permit-areas-fill', { point: { x: 342, y: 352 }, features: [{ properties: { name: 'Another' } }] });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('0'));
  });

  it('render-frame validation hides lingering tooltip when no features under last pointer', async () => {
    const map = makeMap();
    render(<Harness map={map} mode="parks" />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    // Show tooltip and set last pointer
    map.__trigger('mousemove', 'permit-areas-fill', { point: { x: 380, y: 390 }, features: [{ properties: { name: 'Fort Greene' } }] });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('1'));
    // No features now at that pointer
    map.__setQueryRenderedFeatures(() => []);
    map.__trigger('render');
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('0'));
  });
});

describe('usePermitAreas tooltip behavior (intersections mode)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('shows Tip on intersections mousemove when Zone Creator not active; hides on mouseleave', async () => {
    const map = makeMap();
    render(<Harness map={map} mode="intersections" />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    map.__trigger('mousemove', 'intersections-points', { point: { x: 120, y: 130 }, features: [{ id: 1, properties: {} }] });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('1'));
    // Content contains Tip label
    // We only check visible state here as content labels may vary
    map.__trigger('mouseleave', 'intersections-points', {});
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('0'));
  });

  it('hides on map-level mousemove when no features at pointer', async () => {
    const map = makeMap();
    render(<Harness map={map} mode="intersections" />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    map.__trigger('mousemove', 'intersections-points', { point: { x: 150, y: 160 }, features: [{ id: 2, properties: {} }] });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('1'));
    map.__setQueryRenderedFeatures(() => []);
    map.__trigger('mousemove', undefined, { point: { x: 151, y: 161 } });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('0'));
  });

  it('hides when overlays intercept pointer (document mousemove target not canvas)', async () => {
    const map = makeMap();
    render(<Harness map={map} mode="intersections" />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    map.__trigger('mousemove', 'intersections-points', { point: { x: 200, y: 210 }, features: [{ id: 3, properties: {} }] });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('1'));
    const container = map.getCanvasContainer();
    const overlay = document.createElement('div');
    container.appendChild(overlay);
    overlay.dispatchEvent(new MouseEvent('mousemove', { clientX: 220, clientY: 230, bubbles: true }));
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('0'));
  });

  it('hides on interaction starts (dragstart) and on render-frame validation with no features', async () => {
    const map = makeMap();
    render(<Harness map={map} mode="intersections" />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    map.__trigger('mousemove', 'intersections-points', { point: { x: 240, y: 250 }, features: [{ id: 4, properties: {} }] });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('1'));
    map.__trigger('dragstart');
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('0'));
    // Show again, then ensure render validation hides when empty
    map.__trigger('mousemove', 'intersections-points', { point: { x: 260, y: 270 }, features: [{ id: 5, properties: {} }] });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('1'));
    map.__setQueryRenderedFeatures(() => []);
    map.__trigger('render');
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('0'));
  });
});

describe('usePermitAreas tooltip behavior (plazas mode)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('shows hover tooltip on plaza fill mousemove; hides on mouseleave', async () => {
    const map = makeMap();
    render(<Harness map={map} mode="plazas" />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    map.__trigger('mousemove', 'plaza-areas-fill', { point: { x: 120, y: 130 }, features: [{ properties: { name: 'Herald Sq' } }] });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('1'));
    map.__trigger('mouseleave', 'plaza-areas-fill', {});
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('0'));
  });

  it('hides on map-level mousemove when no features at pointer', async () => {
    const map = makeMap();
    render(<Harness map={map} mode="plazas" />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    map.__trigger('mousemove', 'plaza-areas-fill', { point: { x: 150, y: 160 }, features: [{ properties: { name: 'Times Sq' } }] });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('1'));
    map.__setQueryRenderedFeatures(() => []);
    map.__trigger('mousemove', undefined, { point: { x: 151, y: 161 } });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('0'));
  });

  it('hides when overlays intercept pointer and on interaction starts', async () => {
    const map = makeMap();
    render(<Harness map={map} mode="plazas" />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    map.__trigger('mousemove', 'plaza-areas-fill', { point: { x: 200, y: 210 }, features: [{ properties: { name: 'Union Sq' } }] });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('1'));
    const container = map.getCanvasContainer();
    const overlay = document.createElement('div');
    container.appendChild(overlay);
    overlay.dispatchEvent(new MouseEvent('mousemove', { clientX: 220, clientY: 230, bubbles: true }));
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('0'));
    // Show again then dragstart hide
    map.__trigger('mousemove', 'plaza-areas-fill', { point: { x: 220, y: 230 }, features: [{ properties: { name: 'Madison Sq' } }] });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('1'));
    map.__trigger('dragstart');
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('0'));
  });

  it('render-frame validation hides lingering tooltip when no features under last pointer', async () => {
    const map = makeMap();
    render(<Harness map={map} mode="plazas" />);
    await waitFor(() => expect(map.on).toHaveBeenCalled());
    map.__trigger('mousemove', 'plaza-areas-fill', { point: { x: 260, y: 270 }, features: [{ properties: { name: 'Columbus Cir' } }] });
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('1'));
    map.__setQueryRenderedFeatures(() => []);
    map.__trigger('render');
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('0'));
  });
});


