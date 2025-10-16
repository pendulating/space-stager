import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import SpaceStager from '../SpaceStager.jsx';
import { GeographyProvider } from '../../contexts/GeographyContext.jsx';
import { TutorialProvider } from '../../contexts/TutorialContext.jsx';
import { SitePlanProvider } from '../../contexts/SitePlanContext.jsx';
import { ZoneCreatorProvider } from '../../contexts/ZoneCreatorContext.jsx';
import { GeoclientAuthProvider } from '../../contexts/GeoclientAuthContext.jsx';

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

// Mock key hooks that do heavy lifting to avoid complex map setup
vi.mock('../../hooks/useMap', () => ({ useMap: () => ({
  map: {
    on: () => {},
    off: () => {},
    once: () => {},
    getZoom: () => 18,
    loaded: () => true,
    isStyleLoaded: () => true,
    getSource: () => undefined,
    addSource: () => {},
    removeSource: () => {},
    addLayer: () => {},
    removeLayer: () => {},
    getLayer: () => null,
    setLayoutProperty: () => {},
    setPaintProperty: () => {},
    setFilter: () => {},
    getStyle: () => ({ layers: [] }),
    easeTo: () => {},
    fitBounds: () => {},
    project: () => ({ x: 0, y: 0 }),
    unproject: () => ({ lng: 0, lat: 0 })
  },
  mapLoaded: true,
  styleLoaded: true
}) }));
vi.mock('../../hooks/usePermitAreas', () => ({ usePermitAreas: () => ({
  isLoading: false,
  loadError: null,
  hasSubFocus: false,
  focusedArea: null,
  subFocusArea: null,
  permitAreas: [],
  loadPermitAreas: () => {},
  clearFocus: () => {},
  setSubFocusPolygon: () => true,
  clearSubFocusPolygon: () => {},
  focusOnPermitArea: () => {},
  showFocusInfo: false,
  setShowFocusInfo: () => {},
  showZoomBoundaryWarning: true,
  handleZoomBoundaryConfirm: () => {},
  handleZoomBoundaryCancel: () => {},
}) }));
vi.mock('../../hooks/useDrawTools', () => ({ useDrawTools: () => ({ draw: { current: { getAll: () => ({ features: [] }) } }, activateDrawingTool: () => {}, clearCustomShapes: () => {}, forceReinitialize: () => {} }) }));
vi.mock('../../hooks/useNudges', () => ({ useNudges: () => ({ nudges: [], dismiss: () => {}, zoomTo: () => {}, highlight: () => {}, highlightedIds: [] }) }));
vi.mock('../../hooks/useClickToPlace', () => ({ useClickToPlace: () => ({ droppedObjects: [], clearDroppedObjects: () => {}, setDroppedObjects: () => {} }) }));
vi.mock('../../hooks/useInfrastructure', () => ({ useInfrastructure: () => ({ clearFocus: () => {}, reloadVisibleLayers: () => {} }) }));

describe('SpaceStager sanity', () => {
  beforeEach(() => {
    try { localStorage.removeItem('theme'); } catch (_) {}
  });

  it('toggles dark mode class on html root via header button click', () => {
    const { getByLabelText } = render(<Providers><SpaceStager /></Providers>);
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    const toggle = getByLabelText('Toggle dark mode', { selector: 'button' });
    if (toggle) {
      fireEvent.click(toggle);
      expect(root.classList.contains('dark')).not.toBe(hadDark);
    }
  });

  it('renders sidebar collapse/expand handle and toggles state', () => {
    const { getByLabelText, getByTitle, queryByTitle } = render(<Providers><SpaceStager /></Providers>);
    // Collapse via Sidebar button (aria-label used)
    const collapse = getByLabelText('Collapse sidebar');
    fireEvent.click(collapse);
    // Handle appears to re-open (title on handle)
    const reopen = getByTitle('Show sidebar');
    fireEvent.click(reopen);
    expect(queryByTitle('Show sidebar')).toBeNull();
  });
});


