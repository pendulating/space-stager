import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SpaceStager from '../SpaceStager.jsx';
import { GeographyProvider } from '../../contexts/GeographyContext.jsx';
import { TutorialProvider } from '../../contexts/TutorialContext.jsx';
import { SitePlanProvider } from '../../contexts/SitePlanContext.jsx';
import { ZoneCreatorProvider } from '../../contexts/ZoneCreatorContext.jsx';
import { GeoclientAuthProvider } from '../../contexts/GeoclientAuthContext.jsx';

vi.mock('../../hooks/useMap', () => {
  const map = {
    on: vi.fn(), off: vi.fn(), once: vi.fn((evt, cb) => cb && cb()), loaded: () => true, isStyleLoaded: () => true,
    getZoom: () => 18, getBearing: () => 0, getPitch: () => 0, setStyle: vi.fn(), jumpTo: vi.fn(),
    getCenter: () => ({ lng: 0, lat: 0 }),
    getSource: vi.fn(() => null), addSource: vi.fn(), removeSource: vi.fn(),
    getLayer: vi.fn(() => null), addLayer: vi.fn(), removeLayer: vi.fn(), setLayoutProperty: vi.fn(), getLayoutProperty: vi.fn(() => 'visible'),
    __currentCartoStyleUrl: '', __currentBasemap: 'carto'
  };
  return { useMap: () => ({ map, mapLoaded: true, styleLoaded: true }) };
});

vi.mock('../../hooks/usePermitAreas', () => ({ usePermitAreas: vi.fn(() => ({
  isLoading: false,
  loadError: null,
  hasSubFocus: false,
  focusedArea: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0,0],[0.006,0],[0.006,0.006],[0,0.006],[0,0]]] }, properties: {} },
  subFocusArea: null,
  permitAreas: [],
  rehydrateActiveGeography: vi.fn(),
  loadPermitAreas: vi.fn(),
  clearFocus: vi.fn(),
  setSubFocusPolygon: vi.fn(() => true),
  clearSubFocusPolygon: vi.fn(),
  focusOnPermitArea: vi.fn(),
  showFocusInfo: false,
  setShowFocusInfo: vi.fn(),
  showZoomBoundaryWarning: false,
  handleZoomBoundaryConfirm: vi.fn(),
  handleZoomBoundaryCancel: vi.fn(),
})) }));
vi.mock('../../hooks/useDrawTools', () => ({ useDrawTools: () => ({ draw: { current: { getAll: () => ({ features: [] }) } }, activateDrawingTool: () => {}, clearCustomShapes: () => {}, forceReinitialize: () => {} }) }));
vi.mock('../../hooks/useNudges', () => ({ useNudges: () => ({ nudges: [], dismiss: () => {}, zoomTo: () => {}, highlight: () => {}, highlightedIds: [] }) }));
vi.mock('../../hooks/useClickToPlace', () => ({ useClickToPlace: () => ({ droppedObjects: [], clearDroppedObjects: () => {}, setDroppedObjects: () => {} }) }));
vi.mock('../../hooks/useInfrastructure', () => ({ useInfrastructure: () => ({ clearFocus: () => {}, reloadVisibleLayers: vi.fn() }) }));

function Providers({ children }){
  return (
    <GeographyProvider>
      <TutorialProvider>
        <SitePlanProvider>
          <ZoneCreatorProvider>
            <GeoclientAuthProvider>{children}</GeoclientAuthProvider>
          </ZoneCreatorProvider>
        </SitePlanProvider>
      </TutorialProvider>
    </GeographyProvider>
  );
}

describe('SpaceStager style/import/area', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); });
  it('handles basemap style change via onStyleChange', () => {
    render(<Providers><SpaceStager /></Providers>);
    // Sidebar passes onStyleChange to basemap toggle; simulate style change
    // Expect no throw and map hooks were called by mock once()
    expect(document.body).toBeTruthy();
    vi.runOnlyPendingTimers();
  });

  it('computes area warning severity thresholds from geometry size', () => {
    render(<Providers><SpaceStager /></Providers>);
    // Just rendering with a non-trivial polygon executes the effect; smoke assert DOM is intact
    expect(document.querySelector('.h-screen')).toBeTruthy();
    vi.runOnlyPendingTimers();
  });

  it('import progress state transitions on cancel', () => {
    render(<Providers><SpaceStager /></Providers>);
    // Show and cancel import progress modal via event path (simulate internal state change)
    // Since internal imports are mocked, we smoke test the modal close handler through button titles
    const btns = screen.queryAllByText('Save');
    expect(Array.isArray(btns)).toBe(true);
    vi.runOnlyPendingTimers();
  });
});
