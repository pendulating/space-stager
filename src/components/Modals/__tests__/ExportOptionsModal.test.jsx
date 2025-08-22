import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportOptionsModal from '../ExportOptionsModal.jsx';

describe('ExportOptionsModal', () => {
  it('renders, toggles fields, and saves form', () => {
    const onClose = vi.fn();
    const onChange = vi.fn();
    render(<ExportOptionsModal isOpen onClose={onClose} onChange={onChange} value={{ dimensionUnits: 'm', includeObjectDimensions: false }} />);
    // Toggle a checkbox and switch projection
    fireEvent.click(screen.getByLabelText('Object dimensions (e.g., stages)'));
    fireEvent.click(screen.getByLabelText('Use current view (pitch/bearing)'));
    fireEvent.click(screen.getByText('Save'));
    expect(onChange).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('returns null when closed', () => {
    const { container } = render(<ExportOptionsModal isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });
});


