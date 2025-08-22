import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import NudgeCenter from '../NudgeCenter.jsx';

describe('NudgeCenter', () => {
  it('renders empty state pill when no nudges', () => {
    render(<NudgeCenter nudges={[]} />);
    expect(screen.getByText('No nudges')).toBeInTheDocument();
  });

  it('renders list of nudges and fires callbacks', () => {
    const onZoom = vi.fn();
    const onHighlight = vi.fn();
    const onDismiss = vi.fn();
    const nudges = [
      { id: 'n1', severity: 'info', message: 'Check spacing' },
      { id: 'n2', severity: 'warning', message: 'Too close to hydrant', citation: 'https://example.com' },
    ];
    render(<NudgeCenter nudges={nudges} onZoom={onZoom} onHighlight={onHighlight} onDismiss={onDismiss} />);

    expect(screen.getByText('Contextual Nudges')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    // Buttons exist
    const zoomButtons = screen.getAllByText('Zoom');
    const highlightButtons = screen.getAllByText('Highlight');
    expect(zoomButtons).toHaveLength(2);
    expect(highlightButtons).toHaveLength(2);

    fireEvent.click(zoomButtons[0]);
    expect(onZoom).toHaveBeenCalledWith(nudges[0]);

    fireEvent.click(highlightButtons[1]);
    expect(onHighlight).toHaveBeenCalledWith(nudges[1]);

    const dismissButtons = screen.getAllByTitle('Ignore');
    fireEvent.click(dismissButtons[0]);
    expect(onDismiss).toHaveBeenCalledWith('n1');
  });
});


