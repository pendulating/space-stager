import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CustomShapeLabels from '../CustomShapeLabels.jsx';

function makeDraw(features) {
  return { current: { getAll: () => ({ features }) } };
}

function makeMap() {
  return { project: ([lng, lat]) => ({ x: lng * 10, y: -lat * 10 }), triggerRepaint: () => {} };
}

describe('CustomShapeLabels', () => {
  it('renders labels for shapes with label and maps coordinates to screen', () => {
    const features = [
      { id: 's1', geometry: { type: 'Point', coordinates: [-74, 40.7] }, properties: { label: 'Booth' } },
      { id: 's2', geometry: { type: 'Polygon', coordinates: [[[-74,40.7],[-74,40.71],[-73.99,40.71],[-73.99,40.7],[-74,40.7]]] }, properties: { label: 'Zone' } },
      { id: 's3', geometry: { type: 'Point', coordinates: [-74, 40.7] }, properties: { } }
    ];
    render(<CustomShapeLabels draw={makeDraw(features)} map={makeMap()} objectUpdateTrigger={0} showLabels={true} />);
    expect(screen.getByText('Booth')).toBeInTheDocument();
    expect(screen.getByText('Zone')).toBeInTheDocument();
  });
});


