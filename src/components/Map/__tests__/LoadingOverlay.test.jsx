import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingOverlay from '../LoadingOverlay.jsx';

describe('LoadingOverlay', () => {
  it('renders nothing when not loading', () => {
    const { container } = render(<LoadingOverlay isLoading={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders spinner and text when loading', () => {
    render(<LoadingOverlay isLoading={true} />);
    expect(screen.getByText(/Loading map/i)).toBeInTheDocument();
  });

  it('optionally renders debug info', () => {
    render(<LoadingOverlay isLoading={true} showDebugInfo={true} />);
    expect(screen.getByText(/debugging info/i)).toBeInTheDocument();
  });
});


