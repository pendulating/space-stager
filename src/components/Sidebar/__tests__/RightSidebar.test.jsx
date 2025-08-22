import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RightSidebar from '../RightSidebar.jsx';

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
    render(<RightSidebar {...props} />);
    // Export buttons
    fireEvent.click(screen.getByText('Save Draft'));
    expect(props.onExport).toHaveBeenCalled();

    // Open export menu and select PNG
    fireEvent.click(screen.getByText('Export Site Plan'));
    fireEvent.click(screen.getByText('PNG Image'));
    expect(props.onExportSiteplan).toHaveBeenCalledWith('png');

    // Event Info and Export Options fire custom events (smoke test presence)
    expect(screen.getByText('Event Information')).toBeInTheDocument();
    // There is a header and a button with the same text; just assert presence
    expect(screen.getAllByText('Export Options').length).toBeGreaterThan(0);
  });

  it('disables siteplan export when no focused area', () => {
    const props = makeProps({ focusedArea: null });
    render(<RightSidebar {...props} />);
    const btn = screen.getByText('Export Site Plan').closest('button');
    expect(btn).toBeDisabled();
  });
});


