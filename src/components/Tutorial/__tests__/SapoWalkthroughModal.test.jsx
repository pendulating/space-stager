import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import SapoWalkthroughModal from '../SapoWalkthroughModal.jsx';

describe('SapoWalkthroughModal', () => {
  it('returns null when not open', () => {
    const { container } = render(<SapoWalkthroughModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders content and calls onClose with checkbox state', () => {
    const onClose = vi.fn();
    render(<SapoWalkthroughModal isOpen={true} onClose={onClose} />);

    expect(screen.getByText('How to stage plazas and intersections')).toBeInTheDocument();

    // Toggle checkbox then close via button
    const checkbox = screen.getByLabelText("Don't show again");
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledWith({ dontShowAgain: true });
  });
});


