import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RightSidebar from '../RightSidebar.jsx';
import { DroppedObjectsProvider } from '../../../contexts/DroppedObjectsContext.jsx';

describe('RightSidebar (right)', () => {
  function makeProps(overrides = {}) {
    return {
      drawTools: {
        activeTool: null,
        activateDrawingTool: vi.fn(),
        selectedShape: null,
        deleteSelectedShape: vi.fn(),
        draw: { current: { getAll: () => ({ features: [] }), getMode: () => 'simple_select' } },
        reinitializeDrawControls: vi.fn(),
        activeRectObjectTypeId: null,
        selectShape: vi.fn(),
        renameShape: vi.fn(),
        showLabels: true,
        setShowLabels: vi.fn(),
      },
      clickToPlace: {
        placementMode: null,
        activatePlacementMode: vi.fn(),
        droppedObjects: [{ id: 'o1', type: 'bench', name: 'Bench 1' }],
        removeDroppedObject: vi.fn(),
      },
      placeableObjects: [{ id: 'bench', name: 'Bench', color: '#333' }],
      onExport: vi.fn(),
      onExportSiteplan: vi.fn(),
      onImport: vi.fn(),
      focusedArea: { properties: { name: 'Union Park' } },
      ...overrides,
    };
  }

  it('renders drawing tools and placeable objects, and export actions', () => {
    const props = makeProps();
    render(
      <DroppedObjectsProvider>
        <RightSidebar {...props} />
      </DroppedObjectsProvider>
    );
    // Export buttons
    fireEvent.click(screen.getByText(/Save Digital Plan/));
    expect(props.onExport).toHaveBeenCalled();

    // Open export menu and select PDF
    fireEvent.click(screen.getByText('Export Site Plan'));
    fireEvent.click(screen.getByText('PDF Document'));
    expect(props.onExportSiteplan).toHaveBeenCalledWith('pdf');

    // Event Info button present
    expect(screen.getByText('Event Information')).toBeInTheDocument();
  });

  it('disables siteplan export when no focused area', () => {
    const props = makeProps({ focusedArea: null });
    render(
      <DroppedObjectsProvider>
        <RightSidebar {...props} />
      </DroppedObjectsProvider>
    );
    const btn = screen.getByText('Export Site Plan').closest('button');
    expect(btn).toBeDisabled();
  });
});


