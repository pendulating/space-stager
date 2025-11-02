import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TextAnnotationEditor from '../TextAnnotationEditor.jsx';

function makeMapStub() {
  return {
    project: ([lng, lat]) => ({ x: (lng + 180) * 2, y: (90 - lat) * 2 }),
    triggerRepaint: () => {}
  };
}

function makeDrawStub(feature) {
  return {
    current: {
      get: (id) => (id === feature.id ? feature : null),
      add: vi.fn()
    }
  };
}

describe('TextAnnotationEditor', () => {
  it('hydrates state from feature properties and updates inputs', () => {
    const map = makeMapStub();
    const feature = { id: 't1', properties: { label: 'Hello', textSize: 20, textColor: '#ff0000', halo: false }, geometry: { type: 'Point', coordinates: [0, 0] } };
    const drawRef = makeDrawStub(feature);
    render(<TextAnnotationEditor map={map} featureId="t1" drawRef={drawRef} onSave={() => {}} onCancel={() => {}} />);

    const input = screen.getByPlaceholderText('Enter label');
    expect(input.value).toBe('Hello');

    fireEvent.change(input, { target: { value: 'World' } });
    expect(input.value).toBe('World');

    // The label isn't programmatically associated; select the number input by role/type
    const size = screen.getAllByRole('spinbutton')[0];
    fireEvent.change(size, { target: { value: '48' } });
    expect(size.value).toBe('48');

    // The color input isn't label-associated; select by current value
    const color = screen.getByDisplayValue('#ff0000');
    fireEvent.change(color, { target: { value: '#00ff00' } });
    expect(color.value).toBe('#00ff00');

    const halo = screen.getByLabelText('Text halo for contrast');
    fireEvent.click(halo);
    expect(halo).toBeChecked();
  });

  it('saves on Enter and cancels on Escape', () => {
    const map = makeMapStub();
    const feature = { id: 't2', properties: { label: '', textSize: 14, textColor: '#111827', halo: true }, geometry: { type: 'Point', coordinates: [10, -5] } };
    const drawRef = makeDrawStub(feature);
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<TextAnnotationEditor map={map} featureId="t2" drawRef={drawRef} onSave={onSave} onCancel={onCancel} />);

    const input = screen.getByPlaceholderText('Enter label');
    fireEvent.change(input, { target: { value: 'Note' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ label: 'Note' }));

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('returns null when feature missing', () => {
    const map = makeMapStub();
    const feature = { id: 'x', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } };
    const drawRef = makeDrawStub(feature);
    const { container } = render(<TextAnnotationEditor map={map} featureId="missing" drawRef={drawRef} />);
    expect(container.firstChild).toBeNull();
  });
});


