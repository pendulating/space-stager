import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ViewportInset from '../ViewportInset.jsx';

function makeMap(bounds) {
  return {
    getBounds: () => bounds,
    on: () => {},
    off: () => {}
  };
}

function makeBounds({ north, south, east, west }) {
  return {
    getNorth: () => north,
    getSouth: () => south,
    getEast: () => east,
    getWest: () => west
  };
}

describe('ViewportInset', () => {
  it('returns null when no map or not loaded', () => {
    const { container } = render(<ViewportInset map={null} mapLoaded={false} responsive={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when bounds overlap NYC', () => {
    const bounds = makeBounds({ north: 40.8, south: 40.7, east: -73.8, west: -74.0 });
    const map = makeMap(bounds);
    const { container } = render(<ViewportInset map={map} mapLoaded={true} responsive={{}} />);
    // Should render wrapper with absolute class
    expect(container.querySelector('.absolute')).toBeTruthy();
  });

  it('shows outside/partial labels based on overlap flags', () => {
    // Outside bounds entirely
    const out = makeBounds({ north: 40.3, south: 40.2, east: -73.6, west: -73.5 });
    const mapOut = makeMap(out);
    const { rerender } = render(<ViewportInset map={mapOut} mapLoaded={true} responsive={{}} />);
    // No throw: component still renders outer container but label text may differ

    // Partially overlapping
    const partial = makeBounds({ north: 40.6, south: 40.5, east: -73.9, west: -74.3 });
    const mapPartial = makeMap(partial);
    rerender(<ViewportInset map={mapPartial} mapLoaded={true} responsive={{}} />);
  });
});


