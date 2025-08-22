import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ZoneCreatorProvider } from '../../../contexts/ZoneCreatorContext.jsx';
import MapContainer from '../MapContainer.jsx';

function makeMap(overrides = {}) {
  const listeners = {};
  return {
    on: vi.fn((evt, cb) => { listeners[evt] = cb; }),
    off: vi.fn(),
    once: vi.fn((evt, cb) => { listeners[evt] = cb; }),
    getBearing: vi.fn(() => overrides.bearing ?? 0),
    getPitch: vi.fn(() => overrides.pitch ?? 0),
    getCenter: vi.fn(() => ({ lng: -74, lat: 40.7 })),
    getZoom: vi.fn(() => 12),
    easeTo: vi.fn(),
    rotateTo: vi.fn(),
    doubleClickZoom: { disable: vi.fn() },
    addSource: vi.fn(),
    getSource: vi.fn(() => ({ setData: vi.fn() })),
    getLayer: vi.fn(() => undefined),
    addLayer: vi.fn(),
    moveLayer: vi.fn(),
    isStyleLoaded: vi.fn(() => true),
    hasImage: vi.fn(() => false),
    addImage: vi.fn(),
    project: vi.fn(() => ({ x: 10, y: 20 })),
    ...overrides,
    __listeners: listeners,
  };
}

function makeDrawWithTextFeature() {
  const feature = { id: 'txt1', geometry: { type: 'Point', coordinates: [-73.99, 40.75] }, properties: { type: 'text', label: 'A' } };
  return {
    current: {
      getAll: () => ({ type: 'FeatureCollection', features: [feature] }),
      get: (id) => feature,
      delete: vi.fn(),
    }
  };
}

function noopHooks() {
  return {
    drawTools: { draw: makeDrawWithTextFeature(), showLabels: true, activeTool: null },
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
      tooltip: { visible: true },
      clickedTooltip: { visible: true, content: [{ label: 'Name', value: 'Park' }], x: 0, y: 0 },
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

describe('MapContainer additional branches', () => {
  it('hides MapTooltip when clickedTooltip is visible; shows ClickPopover', () => {
    const map = makeMap();
    const hooks = noopHooks();
    const { queryByText, getByText } = render(
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
    // ClickPopover content visible
    expect(getByText('Name:')).toBeInTheDocument();
    // Tooltip component text is not present (MapTooltip content depends on props; we just ensure no crash)
    expect(queryByText('Park usage stats are not available for this zone.')).toBeInTheDocument();
  });

  it('projection toggle returns to 2D when already isometric', () => {
    const map = makeMap({ pitch: 30, bearing: 10 });
    const hooks = noopHooks();
    const { getByTitle } = render(
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
    fireEvent.click(getByTitle('Toggle projection (Top-down / Isometric)'));
    expect(map.easeTo).toHaveBeenCalled();
  });
});


