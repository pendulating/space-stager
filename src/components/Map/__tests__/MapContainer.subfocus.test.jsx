import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { ZoneCreatorProvider } from '../../../contexts/ZoneCreatorContext.jsx';
import { DroppedObjectsProvider } from '../../../contexts/DroppedObjectsContext.jsx';
import MapContainer from '../MapContainer.jsx';

function makeMap(overrides = {}) {
  const listeners = {};
  return {
    on: vi.fn((evt, cb) => { listeners[evt] = cb; }),
    off: vi.fn((evt) => { delete listeners[evt]; }),
    once: vi.fn((evt, cb) => { listeners[evt] = cb; }),
    getBearing: vi.fn(() => overrides.bearing ?? 0),
    rotateTo: vi.fn(),
    easeTo: vi.fn(),
    getPitch: vi.fn(() => overrides.pitch ?? 0),
    getCenter: vi.fn(() => ({ lng: -74, lat: 40.7 })),
    getZoom: vi.fn(() => 12),
    doubleClickZoom: { disable: vi.fn() },
    addSource: vi.fn(),
    getSource: vi.fn(() => ({ setData: vi.fn() })),
    getLayer: vi.fn(() => undefined),
    addLayer: vi.fn(),
    moveLayer: vi.fn(),
    setLayoutProperty: vi.fn(),
    setFilter: vi.fn(),
    getFilter: vi.fn(() => null),
    setPaintProperty: vi.fn(),
    loaded: vi.fn(() => true),
    isStyleLoaded: vi.fn(() => true),
    hasImage: vi.fn(() => true), // prevent canvas icon registration
    addImage: vi.fn(),
    getStyle: vi.fn(() => ({ layers: [] })),
    project: vi.fn(() => ({ x: 10, y: 20 })),
    ...overrides,
    __listeners: listeners
  };
}

function makeDrawRef() {
  return {
    current: {
      getAll: () => ({ features: [] }),
      getMode: () => 'simple_select',
      delete: vi.fn()
    }
  };
}

function makeHooks() {
  return {
    drawTools: { draw: makeDrawRef(), showLabels: true, activeTool: null, clearCustomShapes: vi.fn() },
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
      focusedArea: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0,0],[0,1],[1,1],[1,0],[0,0]]] } },
      setSubFocusPolygon: vi.fn(() => true),
    },
  };
}

describe('MapContainer subfocus integration', () => {
  let map;
  let hooks;
  beforeEach(() => {
    map = makeMap();
    hooks = makeHooks();
  });

  it('converts a drawn polygon into subfocus when armed and deletes draw feature', () => {
    render(
      <DroppedObjectsProvider>
        <ZoneCreatorProvider>
          <MapContainer
            map={map}
            mapLoaded={true}
            focusedArea={hooks.permitAreas.focusedArea}
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

    // Arm subfocus mode
    window.dispatchEvent(new CustomEvent('subfocus:arm'));

    // Simulate draw.create for a polygon
    const poly = { type: 'Feature', id: 'drawn-1', properties: {}, geometry: { type: 'Polygon', coordinates: [[[0,0],[0,0.2],[0.2,0.2],[0.2,0],[0,0]]] } };
    map.__listeners['draw.create'] && map.__listeners['draw.create']({ features: [poly] });

    expect(hooks.permitAreas.setSubFocusPolygon).toHaveBeenCalledTimes(1);
    expect(hooks.permitAreas.setSubFocusPolygon).toHaveBeenCalledWith({ type: 'Feature', properties: {}, geometry: poly.geometry });
    expect(hooks.drawTools.draw.current.delete).toHaveBeenCalledWith('drawn-1');
  });
});


