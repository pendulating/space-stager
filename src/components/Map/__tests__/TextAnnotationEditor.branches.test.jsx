import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TextAnnotationEditor from '../TextAnnotationEditor.jsx';

function makeMap(){ return { project: () => ({ x: 10, y: 15 }), triggerRepaint: vi.fn() }; }

function makeDrawWithFeature(props = {}) {
  const feature = { id: 't1', geometry: { type: 'Point', coordinates: [-73.99, 40.75] }, properties: { label: '', ...props } };
  const store = new Map([[feature.id, feature]]);
  return {
    current: {
      get: (id) => store.get(id),
      add: (f) => store.set(f.id, f)
    }
  };
}

describe('TextAnnotationEditor branches', () => {
  it('saves form to draw feature and calls onSave', () => {
    const drawRef = makeDrawWithFeature();
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const { getByRole, container } = render(
      <TextAnnotationEditor map={makeMap()} featureId="t1" drawRef={drawRef} onSave={onSave} onCancel={onCancel} />
    );
    fireEvent.change(getByRole('textbox'), { target: { value: 'Hello' } });
    const colorInput = container.querySelector('input[type="color"]');
    const sizeInput = container.querySelector('input[type="number"]');
    fireEvent.change(colorInput, { target: { value: '#ff0000' } });
    fireEvent.change(sizeInput, { target: { value: '18' } });
    fireEvent.click(getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalled();
    expect(drawRef.current.get('t1').properties.label).toBe('Hello');
    expect(drawRef.current.get('t1').properties.textColor).toBe('#ff0000');
    expect(drawRef.current.get('t1').properties.textSize).toBe(18);
  });
});


