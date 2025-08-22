import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NudgeMarkers from '../NudgeMarkers.jsx';

function makeMap() {
  return { project: ([lng, lat]) => ({ x: lng * 10, y: lat * 10 }) };
}

describe('NudgeMarkers', () => {
  it('renders markers at projected positions and allows dismiss', () => {
    const map = makeMap();
    const nudges = [
      { id: 'n1', severity: 'info', message: 'Place away from hydrant', subject: { position: { lng: 11, lat: 22 } } },
      { id: 'n2', severity: 'warning', message: 'Too close to curb', subject: { position: { lng: 12, lat: 23 } } },
    ];
    const onDismiss = vi.fn();
    render(<NudgeMarkers nudges={nudges} map={map} highlightedIds={new Set(['n2'])} onDismiss={onDismiss} />);
    expect(screen.getByText('Place away from hydrant')).toBeInTheDocument();
    expect(screen.getByText('Too close to curb')).toBeInTheDocument();
    const dismissButtons = screen.getAllByTitle('Ignore');
    fireEvent.click(dismissButtons[0]);
    expect(onDismiss).toHaveBeenCalledWith('n1');
  });
});


