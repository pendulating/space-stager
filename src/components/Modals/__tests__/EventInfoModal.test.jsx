import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EventInfoModal from '../EventInfoModal.jsx';

describe('EventInfoModal', () => {
  it('renders null when closed', () => {
    const { container } = render(<EventInfoModal isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('saves form and calls onChange and onClose', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    const { container } = render(<EventInfoModal isOpen={true} onChange={onChange} onClose={onClose} value={{ name: 'Old' }} />);

    const inputs = container.querySelectorAll('input');
    // Order: name, organizer, contact, date, time, attendance, permit
    fireEvent.change(inputs[0], { target: { value: 'Block Party' } });
    fireEvent.change(inputs[1], { target: { value: 'DTPS' } });
    fireEvent.change(inputs[2], { target: { value: 'info@example.com' } });
    fireEvent.change(inputs[3], { target: { value: '2025-08-01' } });
    fireEvent.change(inputs[4], { target: { value: '10-2' } });
    fireEvent.change(inputs[5], { target: { value: '150' } });
    fireEvent.change(inputs[6], { target: { value: 'SAPO-123' } });
    const notes = container.querySelector('textarea');
    fireEvent.change(notes, { target: { value: 'Bring water' } });

    fireEvent.click(screen.getByText('Save'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({
      name: 'Block Party', organizer: 'DTPS', contact: 'info@example.com',
      date: '2025-08-01', time: '10-2', attendance: '150', permit: 'SAPO-123', notes: 'Bring water'
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('cancels without saving', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<EventInfoModal isOpen={true} onChange={onChange} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});


