import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RectangleDimensionsEditor from '../RectangleDimensionsEditor.jsx';

function makeMap() {
  return {
    project: ([lng, lat]) => ({ x: Math.round((lng + 180) * 2), y: Math.round((90 - lat) * 2) })
  };
}

function makeObject({ lng = -73.99, lat = 40.7, widthM = 2, heightM = 3 } = {}) {
  return {
    type: 'rectangle',
    position: { lng, lat },
    properties: { dimensions: { width: widthM, height: heightM } }
  };
}

describe('RectangleDimensionsEditor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders hidden when map or object is missing', () => {
    const { container: c1 } = render(
      <RectangleDimensionsEditor map={null} object={makeObject()} placeableObjects={[]} />
    );
    // style display:none applied via memo
    expect(c1.firstChild).toHaveStyle({ display: 'none' });

    const { container: c2 } = render(
      <RectangleDimensionsEditor map={makeMap()} object={null} placeableObjects={[]} />
    );
    expect(c2.firstChild).toHaveStyle({ display: 'none' });
  });

  it('shows with feet units and converts to meters on Apply', () => {
    const onSave = vi.fn();
    const placeableObjects = [{ id: 'rectangle', units: 'ft' }];
    const object = { ...makeObject({ widthM: 3.048, heightM: 1.524 }), type: 'rectangle' }; // 10ft x 5ft
    render(
      <RectangleDimensionsEditor map={makeMap()} object={object} placeableObjects={placeableObjects} onSave={onSave} />
    );
    // Inputs should display rounded feet (10 and 5)
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs[0]).toHaveValue(10);
    expect(inputs[1]).toHaveValue(5);

    // Change to 12ft x 7ft and Apply => save in meters
    fireEvent.change(inputs[0], { target: { value: '12' } });
    fireEvent.change(inputs[1], { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    // 12 ft -> 3.6576 m, 7 ft -> 2.1336 m (allow small floating error)
    const [w, h] = onSave.mock.calls[0];
    expect(w).toBeCloseTo(12 / 3.28084, 4);
    expect(h).toBeCloseTo(7 / 3.28084, 4);
  });

  it('supports meters units passthrough and Cancel handler', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const placeableObjects = [{ id: 'rectangle-m', units: 'm' }];
    const object = { ...makeObject({ widthM: 2, heightM: 3 }), type: 'rectangle-m' };
    render(
      <RectangleDimensionsEditor map={makeMap()} object={object} placeableObjects={placeableObjects} onSave={onSave} onCancel={onCancel} />
    );
    const inputs = screen.getAllByRole('spinbutton');
    // Values should be meters, rounded
    expect(inputs[0]).toHaveValue(2);
    expect(inputs[1]).toHaveValue(3);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});


