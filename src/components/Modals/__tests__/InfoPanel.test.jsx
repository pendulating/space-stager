import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import InfoPanel from '../InfoPanel.jsx';

describe('InfoPanel', () => {
  it('renders null when showInfo is false', () => {
    const { container } = render(<InfoPanel showInfo={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('closes on overlay click, close button, and Escape key', async () => {
    const onClose = vi.fn();
    render(<InfoPanel showInfo={true} onClose={onClose} />);
    // Click header icon close (has title)
    fireEvent.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();
    cleanup();
    render(<InfoPanel showInfo={true} onClose={onClose} />);
    // Click backdrop (has aria-hidden). Use aria-hidden lookup to avoid fragile selector
    const backdrop = document.querySelector('[aria-hidden="true"]');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();
    cleanup();
    render(<InfoPanel showInfo={true} onClose={onClose} />);
    // Allow effects that subscribe key handlers to run
    await Promise.resolve();
    // Dispatch real KeyboardEvent so useGlobalKeymap picks it up (listeners attach to document)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});


