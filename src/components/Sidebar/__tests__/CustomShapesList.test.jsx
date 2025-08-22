import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CustomShapesList from '../CustomShapesList.jsx';

describe('CustomShapesList', () => {
  function makeDrawMock(features) {
    return {
      current: {
        getAll: () => ({ features }),
        changeMode: vi.fn(),
        getMode: vi.fn(() => 'simple_select')
      }
    };
  }

  const polygon = {
    id: 'poly-1',
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] },
    properties: { user_created: true, label: 'Booth A' }
  };
  const point = {
    id: 'pt-2',
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0.5, 0.5] },
    properties: { user_created: true, label: '' }
  };

  it('renders list, toggles labels, selects and renames', () => {
    const draw = makeDrawMock([polygon, point]);
    const onToggleLabels = vi.fn();
    const onShapeSelect = vi.fn();
    const onShapeRename = vi.fn();

    render(
      <CustomShapesList
        selectedShape={null}
        onShapeSelect={onShapeSelect}
        draw={draw}
        onShapeRename={onShapeRename}
        showLabels={true}
        onToggleLabels={onToggleLabels}
      />
    );

    // Count renders
    expect(screen.getByText(/Event Fixtures \(2\)/)).toBeInTheDocument();

    // Toggle labels
    fireEvent.click(screen.getByRole('button', { name: /Show Labels/i }));
    expect(onToggleLabels).toHaveBeenCalledWith(false);

    // Click a shape item selects via draw.changeMode and calls onShapeSelect
    const firstItem = screen.getByText('Booth A').closest('.custom-shape-item');
    fireEvent.click(firstItem);
    expect(draw.current.changeMode).toHaveBeenCalledWith('simple_select', { featureIds: ['poly-1'] });
    expect(onShapeSelect).toHaveBeenCalledWith('poly-1');

    // Enter rename mode and save
    const renameBtn = firstItem.querySelector('.custom-shape-edit-button');
    fireEvent.click(renameBtn);
    const input = firstItem.querySelector('.custom-shape-edit-input');
    fireEvent.change(input, { target: { value: 'Main Booth' } });
    // Save by pressing Enter
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onShapeRename).toHaveBeenCalledWith('poly-1', 'Main Booth');
  });
});


