import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useSelectionController } from '../useSelectionController.js';

function Harness({ map, placeableObjects, droppedObjects, isPlacementActive, setSelectedRectId, setSelectedPointId }) {
  const { handleClick } = useSelectionController({ map, placeableObjects, droppedObjects, isPlacementActive, setSelectedRectId, setSelectedPointId });
  return (
    <div data-testid="canvas" onClick={(e) => handleClick(e)} />
  );
}

function makeMap() {
  const container = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
  };
  return {
    getContainer: () => container,
    unproject: ([x, y]) => ({ lng: x / 10, lat: y / 10 }),
    project: ([lng, lat]) => ({ x: lng * 10, y: -lat * 10 }),
    getZoom: () => 16
  };
}

describe('useSelectionController hit-testing', () => {
  it('selects rectangle by containment and clears point selection', () => {
    const map = makeMap();
    const placeables = [
      { id: 'rectA', geometryType: 'rect', name: 'Rect' },
      { id: 'cone', geometryType: 'point', size: { width: 24, height: 24 }, name: 'Cone' }
    ];
    const dropped = [
      { id: 'r1', type: 'rectA', geometry: { type: 'Polygon', coordinates: [[[0,0],[2,0],[2,2],[0,2],[0,0]]] } },
      { id: 'p1', type: 'cone', position: { lng: 5, lat: -5 } }
    ];
    const setRect = vi.fn();
    const setPoint = vi.fn();
    const ui = render(
      <Harness map={map} placeableObjects={placeables} droppedObjects={dropped} isPlacementActive={false} setSelectedRectId={setRect} setSelectedPointId={setPoint} />
    );
    const canvas = ui.getByTestId('canvas');
    // Click inside rectangle at lng=1,lat=-1 => x=10,y=10
    fireEvent.click(canvas, { clientX: 10, clientY: 10 });
    expect(setRect).toHaveBeenCalledWith('r1');
    expect(setPoint).toHaveBeenCalledWith(null);
  });

  it('selects nearest point by pixel proximity and clears rect selection', () => {
    const map = makeMap();
    const placeables = [
      { id: 'rectA', geometryType: 'rect', name: 'Rect' },
      { id: 'cone', geometryType: 'point', size: { width: 28, height: 28 }, name: 'Cone' }
    ];
    const dropped = [
      { id: 'p1', type: 'cone', position: { lng: 1, lat: -1 } },
      { id: 'p2', type: 'cone', position: { lng: 3, lat: -3 } },
    ];
    const setRect = vi.fn();
    const setPoint = vi.fn();
    const ui = render(
      <Harness map={map} placeableObjects={placeables} droppedObjects={dropped} isPlacementActive={false} setSelectedRectId={setRect} setSelectedPointId={setPoint} />
    );
    const canvas = ui.getByTestId('canvas');
    // Click near p1 pixel at (10,10)
    fireEvent.click(canvas, { clientX: 12, clientY: 12 });
    expect(setPoint).toHaveBeenCalledWith('p1');
    expect(setRect).toHaveBeenCalledWith(null);
  });
});


