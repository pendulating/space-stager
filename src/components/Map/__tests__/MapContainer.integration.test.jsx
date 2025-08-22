import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ZoneCreatorProvider } from '../../../contexts/ZoneCreatorContext.jsx';
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
    loaded: vi.fn(() => true),
    isStyleLoaded: vi.fn(() => true),
    hasImage: vi.fn(() => false),
    addImage: vi.fn(),
    project: vi.fn(() => ({ x: 10, y: 20 })),
    ...overrides,
    __listeners: listeners,
  };
}

function makeDrawRef() {
  return { current: { getAll: () => ({ features: [] }), getMode: () => 'simple_select' } };
}

function noopHooks() {
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
      focusedArea: null,
      setSubFocusPolygon: vi.fn(),
    },
  };
}

describe('MapContainer integration', () => {
  let map;
  let hooks;
  beforeEach(() => {
    map = makeMap();
    hooks = noopHooks();
  });

  it('renders compass and resets bearing to 0 on click', () => {
    hooks.drawTools.activeTool = null;
    render(
      <ZoneCreatorProvider>
        <MapContainer
          map={map}
          mapLoaded={true}
          focusedArea={null}
          drawTools={hooks.drawTools}
          clickToPlace={hooks.clickToPlace}
          permitAreas={hooks.permitAreas}
          placeableObjects={[]}
          nudges={[]}
          highlightedIds={[]}
          onDismissNudge={vi.fn()}
        />
      </ZoneCreatorProvider>
    );
    const resetBtn = screen.getByTitle('Reset North');
    fireEvent.click(resetBtn);
    expect(map.rotateTo).toHaveBeenCalledWith(0, expect.any(Object));
  });

  it('toggles projection between ISO and 2D', () => {
    render(
      <ZoneCreatorProvider>
        <MapContainer
          map={map}
          mapLoaded={true}
          focusedArea={null}
          drawTools={hooks.drawTools}
          clickToPlace={hooks.clickToPlace}
          permitAreas={hooks.permitAreas}
          placeableObjects={[]}
          nudges={[]}
          highlightedIds={[]}
          onDismissNudge={vi.fn()}
        />
      </ZoneCreatorProvider>
    );
    const toggleBtn = screen.getByTitle('Toggle projection (Top-down / Isometric)');
    // From 2D to ISO
    fireEvent.click(toggleBtn);
    expect(map.easeTo).toHaveBeenCalled();
  });
});


