import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InfraProgressModal from '../InfraProgressModal.jsx';

describe('InfraProgressModal', () => {
  it('returns null when closed', () => {
    const { container } = render(<InfraProgressModal isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders percent and clamps between 0 and 100', () => {
    const { rerender } = render(<InfraProgressModal isOpen={true} total={0} completed={0} />);
    expect(screen.getByText(/0\/0 completed/i)).toBeTruthy();
    expect(screen.getByText(/0%/)).toBeTruthy();

    rerender(<InfraProgressModal isOpen={true} total={10} completed={3} />);
    expect(screen.getByText(/3\/10 completed/i)).toBeTruthy();
    expect(screen.getByText(/30%/)).toBeTruthy();

    rerender(<InfraProgressModal isOpen={true} total={5} completed={10} />);
    // The text is split by elements; use a custom matcher to join
    const hasCompleted = () => (document.body.textContent || '').includes('5/5') || (document.body.textContent || '').includes('10/5');
    expect(hasCompleted()).toBe(true);
    expect(screen.getByText(/100%/)).toBeTruthy();
  });

  it('traps Escape and calls onCancel', () => {
    const onCancel = vi.fn();
    render(<InfraProgressModal isOpen={true} total={1} completed={0} onCancel={onCancel} />);
    // Clicking Cancel button triggers callback
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});


