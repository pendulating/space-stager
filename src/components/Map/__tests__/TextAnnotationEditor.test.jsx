import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TextAnnotationEditor from '../TextAnnotationEditor.jsx';

function makeMap() {
  return {
    project: ([lng, lat]) => ({ x: lng * 10, y: lat * 10 }),
    triggerRepaint: vi.fn()
  };
}

function makeDraw(feature) {
  const store = new Map([[feature.id, feature]]);
  return {
    get: (id) => store.get(id),
    add: (f) => store.set(f.id, f)
  };
}

describe('TextAnnotationEditor', () => {
  it('renders near projected point and saves updates to draw', () => {
    const map = makeMap();
    const feature = { id: 't1', geometry: { type: 'Point', coordinates: [11, 22] }, properties: { label: 'Old', textSize: 12, textColor: '#000', halo: false } };
    const draw = makeDraw(feature);
    const onSave = vi.fn();

    render(
      <TextAnnotationEditor map={map} featureId={feature.id} drawRef={{ current: draw }} onSave={onSave} onCancel={() => {}} />
    );

    const input = screen.getByPlaceholderText('Enter label');
    fireEvent.change(input, { target: { value: 'New Label' } });
    fireEvent.click(screen.getByText('Save'));

    expect(onSave).toHaveBeenCalled();
    const saved = draw.get('t1');
    expect(saved.properties.label).toBe('New Label');
    expect(saved.properties.type).toBe('text');
  });
});


