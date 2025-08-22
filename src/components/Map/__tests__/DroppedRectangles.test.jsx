import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DroppedRectangles from '../DroppedRectangles.jsx';

function makeMap() {
  return { project: ([lng, lat]) => ({ x: lng * 10, y: -lat * 10 }) };
}

describe('DroppedRectangles', () => {
  it('renders svg path and label for rect objects', () => {
    const placeable = [
      { id: 'table', name: 'Table', geometryType: 'rect', units: 'm', texture: { url: '', size: 16 } }
    ];
    const objects = [
      {
        id: 'r1',
        type: 'table',
        geometry: { type: 'Polygon', coordinates: [[[-74,40.7],[-74,40.71],[-73.99,40.71],[-73.99,40.7],[-74,40.7]]] },
        properties: { dimensions: { width: 2.0, height: 1.0 } }
      }
    ];
    render(<DroppedRectangles objects={objects} placeableObjects={placeable} map={makeMap()} objectUpdateTrigger={0} />);
    // label text includes dimensions in m
    expect(screen.getByText(/Table 2.0 m × 1.0 m/)).toBeInTheDocument();
  });
});


