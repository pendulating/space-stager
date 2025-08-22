import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OverlapSelector from '../OverlapSelector.jsx';

const areas = [
  { properties: { name: 'A', propertyname: 'Area A', subpropertyname: ['Block 1', 'Lot 2'] }, calculatedArea: 0.0005 },
  { properties: { name: 'B', propertyname: 'Area B' }, calculatedArea: 0.01 },
];

describe('OverlapSelector', () => {
  it('renders selector when multiple areas and handles select/close', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <OverlapSelector
        overlappingAreas={areas}
        selectedIndex={1}
        clickPosition={{ x: 100, y: 100 }}
        onSelect={onSelect}
        onClose={onClose}
      />
    );
    expect(screen.getByText('Multiple Zones Found')).toBeInTheDocument();
    const optionButtons = screen.getAllByRole('button');
    fireEvent.click(optionButtons[1]); // first area button in list
    expect(onSelect).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByTitle('Close selector'));
    expect(onClose).toHaveBeenCalled();
  });
});


