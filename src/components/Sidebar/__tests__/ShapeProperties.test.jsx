import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ShapeProperties from '../ShapeProperties.jsx';

describe('ShapeProperties', () => {
  function makeDraw(feature) {
    const store = new Map([[feature.id, feature]]);
    return { current: { get: (id) => store.get(id), add: (f) => store.set(f.id, f) } };
  }

  it('renders for selected shape and applies updates', () => {
    const onUpdateShape = vi.fn();
    const feature = { id: 's1', properties: { label: '', textSize: 14, textColor: '#111827', halo: true } };
    const draw = makeDraw(feature);
    const customShapes = [{ id: 's1', type: 'polygon', label: '' }];
    render(<ShapeProperties selectedShape={'s1'} customShapes={customShapes} draw={draw} onUpdateShape={onUpdateShape} />);

    fireEvent.change(screen.getByPlaceholderText('e.g., Stage, Food Truck, Info Booth'), { target: { value: 'Stage' } });
    fireEvent.click(screen.getByText('Apply'));
    expect(onUpdateShape).toHaveBeenCalledWith('s1', { label: 'Stage' });
    expect(draw.current.get('s1').properties.label).toBe('Stage');
  });
});


