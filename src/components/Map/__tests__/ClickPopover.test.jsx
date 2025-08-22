import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ClickPopover from '../ClickPopover.jsx';

describe('ClickPopover', () => {
  const baseTooltip = {
    visible: true,
    x: 100,
    y: 200,
    content: [
      { label: 'Name', value: 'Union Park' },
      { label: 'Property', value: 'Union' }
    ]
  };

  it('renders fields and stats histograms with actions', () => {
    const onClose = vi.fn();
    const onFocus = vi.fn();
    render(
      <ClickPopover
        tooltip={baseTooltip}
        stats={{ a: 1.2, t: 7 }}
        distributions={{ avg: [0,1,2,3,4,5], total: [1,1,2,3,5,8] }}
        onClose={onClose}
        onFocus={onFocus}
      />
    );
    expect(screen.getByText('Union Park')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close popover'));
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Focus on this area'));
    expect(onFocus).toHaveBeenCalled();
  });

  it('returns null when tooltip not visible', () => {
    const { container } = render(<ClickPopover tooltip={{ visible: false }} />);
    expect(container.firstChild).toBeNull();
  });
});


