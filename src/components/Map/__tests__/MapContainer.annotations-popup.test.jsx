import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import MapContainer from '../MapContainer.jsx';
import { ZoneCreatorProvider } from '../../../contexts/ZoneCreatorContext.jsx';
import { DroppedObjectsProvider } from '../../../contexts/DroppedObjectsContext.jsx';

// Minimal Popup stub following MapLibre GL JS signature from context7
class PopupStub {
  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'maplibregl-popup';
    const tip = document.createElement('div');
    tip.className = 'maplibregl-popup-tip';
    this.root.appendChild(tip);
    this.content = document.createElement('div');
    this.content.className = 'maplibregl-popup-content';
    this.root.appendChild(this.content);
  }
  setDOMContent(el) { this.content.innerHTML = ''; this.content.appendChild(el); return this; }
  setLngLat() { return this; }
  addTo() { document.body.appendChild(this.root); return this; }
  remove() { try { this.root.remove(); } catch (_) {} }
  getElement() { return this.root; }
}

function makeMap(overrides = {}) {
  const listeners = {};
  const canvas = document.createElement('div');
  canvas.setAttribute('data-testid', 'map-canvas');
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
  const state = { features: [] };
  return {
    on: vi.fn((evt, cb) => { listeners[evt] = cb; }),
    off: vi.fn((evt) => { delete listeners[evt]; }),
    once: vi.fn((evt, cb) => { listeners[evt] = cb; }),
    getCanvas: () => canvas,
    queryRenderedFeatures: vi.fn(() => state.features),
    unproject: ([x, y]) => ({ lng: x, lat: y }),
    getStyle: vi.fn(() => ({ layers: [] })),
    isStyleLoaded: vi.fn(() => true),
    hasImage: vi.fn(() => true),
    addImage: vi.fn(),
    getSource: vi.fn(() => ({ setData: vi.fn() })),
    addSource: vi.fn(),
    project: vi.fn(() => ({ x: 10, y: 10 })),
    __listeners: listeners,
    __setFeatures: (f) => { state.features = f; },
    ...overrides
  };
}

function makeDrawRef() {
  return {
    current: {
      getAll: () => ({ features: [] }),
      getMode: () => 'simple_select',
      setFeatureProperty: vi.fn(),
      delete: vi.fn()
    }
  };
}

function makeHooks(drawRef) {
  return {
    drawTools: { draw: drawRef, showLabels: true, activeTool: null, clearCustomShapes: vi.fn() },
    clickToPlace: {
      droppedObjects: [],
      objectUpdateTrigger: 0,
      setDroppedObjects: vi.fn(),
      setDroppedObjectNote: vi.fn(),
      removeDroppedObject: vi.fn(),
      handleMapMouseMove: vi.fn(),
      handleMapClick: vi.fn(),
    },
    permitAreas: {
      tooltip: null,
      clickedTooltip: { visible: false },
      overlappingAreas: [],
      selectOverlappingArea: vi.fn(),
      clearOverlapSelector: vi.fn(),
      selectedOverlapIndex: 0,
      clickPosition: null,
      isLoading: false,
      focusedArea: null,
      setSubFocusPolygon: vi.fn(),
      dismissClickedTooltip: vi.fn(),
      focusClickedTooltipArea: vi.fn(),
      showOverlapSelector: false,
    },
  };
}

describe('MapContainer annotations popup', () => {
  let oldLib;
  beforeEach(() => {
    oldLib = window.maplibregl;
    window.maplibregl = { Popup: PopupStub };
  });
  afterEach(() => {
    window.maplibregl = oldLib;
    document.querySelectorAll('.maplibregl-popup').forEach((n) => n.remove());
  });

  it('opens pill for text annotation and Remove deletes feature', () => {
    const map = makeMap();
    const drawRef = makeDrawRef();
    const hooks = makeHooks(drawRef);
    const { container } = render(
      <DroppedObjectsProvider>
        <ZoneCreatorProvider>
          <MapContainer
            map={map}
            mapLoaded={true}
            focusedArea={null}
            drawTools={hooks.drawTools}
            clickToPlace={hooks.clickToPlace}
            permitAreas={hooks.permitAreas}
            placeableObjects={[]}
          infrastructure={{ infrastructureData: {} }}
            nudges={[]}
            highlightedIds={[]}
            onDismissNudge={vi.fn()}
        responsive={{ sidebarMode: 'expanded' }}
          />
        </ZoneCreatorProvider>
      </DroppedObjectsProvider>
    );

    // Simulate a text annotation feature hit
    map.__setFeatures([{ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { sourceId: 'txt-1' } }]);
    const canvas = map.getCanvas();
    fireEvent.mouseDown(canvas, { clientX: 5, clientY: 5 });

    // Popup content added
    const pill = document.querySelector('.maplibregl-popup-content');
    expect(pill).toBeTruthy();
    const removeBtn = Array.from(pill.querySelectorAll('button')).find(b => /Remove/.test(b.textContent || ''));
    expect(removeBtn).toBeTruthy();
    fireEvent.click(removeBtn);
    expect(drawRef.current.delete).toHaveBeenCalled();

    // draw.update closes popup
    map.__listeners['draw.update'] && map.__listeners['draw.update']();
    expect(document.querySelector('.maplibregl-popup')).toBeNull();
  });

  it('opens pill for arrow annotation; Label sets feature property', () => {
    const map = makeMap();
    const drawRef = makeDrawRef();
    const hooks = makeHooks(drawRef);
    const oldPrompt = window.prompt;
    window.prompt = vi.fn(() => 'New Label');
    render(
      <DroppedObjectsProvider>
        <ZoneCreatorProvider>
          <MapContainer
            map={map}
            mapLoaded={true}
            focusedArea={null}
            drawTools={hooks.drawTools}
            clickToPlace={hooks.clickToPlace}
            permitAreas={hooks.permitAreas}
            placeableObjects={[]}
          infrastructure={{ infrastructureData: {} }}
            nudges={[]}
            highlightedIds={[]}
            onDismissNudge={vi.fn()}
            responsive={{ sidebarMode: 'expanded' }}
          />
        </ZoneCreatorProvider>
      </DroppedObjectsProvider>
    );

    // Simulate an arrow feature hit (non-Point geometry)
    map.__setFeatures([{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] }, properties: { sourceId: 'arr-1' } }]);
    const canvas = map.getCanvas();
    fireEvent.mouseDown(canvas, { clientX: 6, clientY: 6 });
    const pill = document.querySelector('.maplibregl-popup-content');
    expect(pill).toBeTruthy();
    const labelBtn = Array.from(pill.querySelectorAll('button')).find(b => /Label/.test(b.textContent || ''));
    expect(labelBtn).toBeTruthy();
    fireEvent.click(labelBtn);
    expect(drawRef.current.setFeatureProperty).toHaveBeenCalledWith('arr-1', 'label', 'New Label');
    window.prompt = oldPrompt;
  });
});


