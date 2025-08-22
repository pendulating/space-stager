import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FocusInfoPanel from '../FocusInfoPanel.jsx';

const area = {
  properties: {
    name: 'Union Park',
    propertyname: 'Block 1',
    subpropertyname: 'Lot 2',
    FSN_1: 'Alt Name'
  }
};

describe('FocusInfoPanel', () => {
  it('renders null when not focused or hidden', () => {
    const { container: c1 } = render(<FocusInfoPanel focusedArea={null} showFocusInfo={true} />);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<FocusInfoPanel focusedArea={area} showFocusInfo={false} />);
    expect(c2.firstChild).toBeNull();
  });

  it('shows title and actions; handles subfocus begin/clear and clear focus', () => {
    const onBeginSubFocus = vi.fn();
    const onClearSubFocus = vi.fn();
    const onClearFocus = vi.fn();
    const onClose = vi.fn();
    render(
      <FocusInfoPanel
        focusedArea={area}
        showFocusInfo={true}
        hasSubFocus={false}
        onBeginSubFocus={onBeginSubFocus}
        onClearSubFocus={onClearSubFocus}
        onClearFocus={onClearFocus}
        onClose={onClose}
      />
    );
    expect(screen.getByText(/Focused on:/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Focus sub-area'));
    expect(onBeginSubFocus).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Clear Focus'));
    expect(onClearFocus).toHaveBeenCalled();
    fireEvent.click(screen.getByTitle('Hide Panel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows clear sub-area when hasSubFocus=true', () => {
    const onClearSubFocus = vi.fn();
    render(
      <FocusInfoPanel
        focusedArea={area}
        showFocusInfo={true}
        hasSubFocus={true}
        onClearSubFocus={onClearSubFocus}
      />
    );
    fireEvent.click(screen.getByText('Clear sub-area'));
    expect(onClearSubFocus).toHaveBeenCalled();
  });
});


