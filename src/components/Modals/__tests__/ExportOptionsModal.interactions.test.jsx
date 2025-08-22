import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportOptionsModal from '../ExportOptionsModal.jsx';

describe('ExportOptionsModal interactions', () => {
  it('toggles projection, checkboxes, units and calls onChange on save', () => {
    const onClose = vi.fn();
    const onChange = vi.fn();
    render(<ExportOptionsModal isOpen={true} onClose={onClose} onChange={onChange} value={{ mapProjectionMode: 'topDown' }} />);

    // Switch projection to current
    const currentRadio = screen.getByLabelText('Use current view (pitch/bearing)');
    fireEvent.click(currentRadio);

    // Toggle a couple of checkboxes
    const zoneDim = screen.getByLabelText('Zone dimensions');
    fireEvent.click(zoneDim);
    const row = screen.getByText('Entire zone PDF (no legend)').closest('div');
    const noLegend = row.querySelector('input[type="checkbox"]');
    fireEvent.click(noLegend);

    // Change units
    const select = screen.getByDisplayValue('Imperial (ft / mi)');
    fireEvent.change(select, { target: { value: 'm' } });

    fireEvent.click(screen.getByText('Save'));
    expect(onChange).toHaveBeenCalled();
    const arg = onChange.mock.calls[0][0];
    expect(arg.mapProjectionMode).toBe('current');
    expect(arg.includeZoneDimensions).toBe(true);
    expect(arg.noLegend).toBe(true);
    expect(arg.dimensionUnits).toBe('m');
  });
});


