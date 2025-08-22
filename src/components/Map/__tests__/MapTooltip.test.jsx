import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MapTooltip from '../MapTooltip.jsx';

describe('MapTooltip', () => {
  it('returns null when tooltip is missing or not visible', () => {
    const { container: c1 } = render(<MapTooltip tooltip={null} />);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<MapTooltip tooltip={{ visible: false }} />);
    expect(c2.firstChild).toBeNull();
  });

  it('renders tooltip content when visible', () => {
    const tooltip = {
      visible: true,
      x: 100,
      y: 200,
      content: [
        { label: 'Street', value: '7 AV' },
        { label: 'Borough', value: 'MN' }
      ]
    };
    render(<MapTooltip tooltip={tooltip} />);
    expect(screen.getByText(/Street:/)).toBeInTheDocument();
    expect(screen.getByText('7 AV')).toBeInTheDocument();
    expect(screen.getByText(/Borough:/)).toBeInTheDocument();
    expect(screen.getByText('MN')).toBeInTheDocument();
  });
});


