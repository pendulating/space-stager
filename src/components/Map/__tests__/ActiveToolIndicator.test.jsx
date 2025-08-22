import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ActiveToolIndicator from '../ActiveToolIndicator.jsx';

describe('ActiveToolIndicator', () => {
  it('renders nothing when no activeTool', () => {
    const { container } = render(<ActiveToolIndicator activeTool={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows instructions for point tool', () => {
    render(<ActiveToolIndicator activeTool="point" />);
    expect(screen.getByText(/Click to add point/i)).toBeInTheDocument();
    expect(screen.getByText(/Press ESC to cancel/i)).toBeInTheDocument();
    cleanup();
  });

  it('shows default message for unknown tool', () => {
    render(<ActiveToolIndicator activeTool="unknown" />);
    expect(screen.getByText(/Select a drawing mode/i)).toBeInTheDocument();
  });
});


