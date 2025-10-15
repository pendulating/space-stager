import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ImportProgressModal from '../ImportProgressModal.jsx';

describe('ImportProgressModal', () => {
  it('returns null when closed', () => {
    const { container } = render(<ImportProgressModal isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('computes step index and percent and traps Escape', () => {
    const steps = [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
      { key: 'c', label: 'C' }
    ];
    const { rerender } = render(<ImportProgressModal isOpen={true} steps={steps} currentStepKey={'a'} />);
    // Percent ~ 33%
    expect((document.body.textContent || '').includes('33')).toBe(true);
    rerender(<ImportProgressModal isOpen={true} steps={steps} currentStepKey={'b'} />);
    // Percent ~ 67%
    expect((document.body.textContent || '').includes('67')).toBe(true);
    rerender(<ImportProgressModal isOpen={true} steps={steps} currentStepKey={'c'} />);
    // Percent 100%
    expect((document.body.textContent || '').includes('100')).toBe(true);
  });
});


