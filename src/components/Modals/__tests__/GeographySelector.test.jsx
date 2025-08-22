import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import GeographySelector from '../GeographySelector.jsx';

describe('GeographySelector', () => {
  beforeEach(() => {
    // Clean storages before each test
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('returns null when not open', () => {
    const { container } = render(<GeographySelector isOpen={false} onContinue={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('enables Continue after selection and calls onContinue with selected id', () => {
    const onContinue = vi.fn();
    render(<GeographySelector isOpen={true} onContinue={onContinue} />);

    // All three cards present
    expect(screen.getByText('Parks Permit Areas')).toBeInTheDocument();
    expect(screen.getByText('DOT Plaza Areas')).toBeInTheDocument();
    expect(screen.getByText('Block-by-Block Street Network')).toBeInTheDocument();

    const continueBtn = screen.getByText('Continue');
    expect(continueBtn).toBeDisabled();

    // Select parks
    fireEvent.click(screen.getByText('Parks Permit Areas'));
    expect(continueBtn).not.toBeDisabled();

    fireEvent.click(continueBtn);
    expect(onContinue).toHaveBeenCalledWith('parks');
  });

  it('opens walkthrough for plazas unless suppressed; closes and sets session flag', () => {
    render(<GeographySelector isOpen={true} onContinue={vi.fn()} />);

    // Select plazas
    fireEvent.click(screen.getByText('DOT Plaza Areas'));

    // Walkthrough should appear
    expect(screen.getByText('How to stage plazas and intersections')).toBeInTheDocument();

    // Close without dontShowAgain
    fireEvent.click(screen.getByLabelText('Close walkthrough'));

    // Session flag should be set
    expect(window.sessionStorage.getItem('sapo_walkthrough_seen_session')).toBe('1');
  });

  it("respects 'Don't show again' to persist opt-out", () => {
    render(<GeographySelector isOpen={true} onContinue={vi.fn()} />);

    // Select intersections
    fireEvent.click(screen.getByText('Block-by-Block Street Network'));
    // Walkthrough opens
    const checkbox = screen.getByLabelText("Don't show again");
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByLabelText('Close walkthrough'));

    expect(window.localStorage.getItem('sapo_walkthrough_dont_show')).toBe('1');
  });
});


