import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import CustomShapeLabels from '../CustomShapeLabels.jsx';

function makeMap() {
  return { project: () => ({ x: 100, y: 200 }), triggerRepaint: () => {} };
}

function makeDraw(features) {
  return { current: { getAll: () => ({ type: 'FeatureCollection', features }) } };
}

describe('CustomShapeLabels branches', () => {
  it('returns empty when showLabels is false or map lacks project', () => {
    const draw = makeDraw([]);
    const { container: c1 } = render(<CustomShapeLabels draw={draw} map={makeMap()} objectUpdateTrigger={0} showLabels={false} />);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<CustomShapeLabels draw={draw} map={{}} objectUpdateTrigger={0} showLabels={true} />);
    expect(c2.firstChild).toBeNull();
  });

  it('renders label for non-text shape with label property', () => {
    const features = [
      { id: 's1', geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] }, properties: { label: 'Zone A', type: 'polygon' } }
    ];
    const draw = makeDraw(features);
    const { getByText } = render(<CustomShapeLabels draw={draw} map={makeMap()} objectUpdateTrigger={1} showLabels={true} />);
    expect(getByText('Zone A')).toBeInTheDocument();
  });
});


