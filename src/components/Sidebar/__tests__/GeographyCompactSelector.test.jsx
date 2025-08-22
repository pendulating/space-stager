import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GeographyCompactSelector from '../GeographyCompactSelector.jsx';

vi.mock('../../../contexts/GeographyContext', () => ({
  useGeography: () => ({ geographyType: 'parks', selectGeography: vi.fn() })
}));

vi.mock('../../Modals/GeographySelector', () => ({
  __esModule: true,
  default: ({ isOpen, onContinue }) => isOpen ? (
    <div>
      <button onClick={() => onContinue('intersections')}>Confirm Intersections</button>
    </div>
  ) : null
}));

describe('GeographyCompactSelector', () => {
  it('opens modal and confirms change', () => {
    const onConfirmChange = vi.fn();
    render(<GeographyCompactSelector onConfirmChange={onConfirmChange} />);
    fireEvent.click(screen.getByText('Wrong mode selected? Click here to switch.'));
    fireEvent.click(screen.getByText('Confirm Intersections'));
    expect(onConfirmChange).toHaveBeenCalledWith('intersections');
  });
});


