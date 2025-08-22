import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import InfoPanel from '../InfoPanel.jsx';

describe('InfoPanel', () => {
  it('renders null when showInfo is false', () => {
    const { container } = render(<InfoPanel showInfo={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('closes on overlay click, close button, and Escape key', () => {
    const onClose = vi.fn();
    render(<InfoPanel showInfo={true} onClose={onClose} />);
    // Click header icon close (has title)
    fireEvent.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    cleanup();
    render(<InfoPanel showInfo={true} onClose={onClose} />);
    // Click backdrop (has aria-hidden). Use aria-hidden lookup to avoid fragile selector
    const backdrop = document.querySelector('[aria-hidden="true"]');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    cleanup();
    render(<InfoPanel showInfo={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});


