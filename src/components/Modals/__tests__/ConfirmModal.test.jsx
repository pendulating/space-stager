import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmModal from '../ConfirmModal.jsx';

describe('ConfirmModal', () => {
  it('renders when open and triggers confirm/cancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmModal isOpen title="Delete" message="Are you sure?" onConfirm={onConfirm} onCancel={onCancel} />
    );
    expect(screen.getByText('Delete')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('returns null when closed', () => {
    const { container } = render(<ConfirmModal isOpen={false} title="T" message="M" />);
    expect(container.firstChild).toBeNull();
  });
});


