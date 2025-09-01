import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import DroppedRectangles from '../DroppedRectangles.jsx';

function makeMap() {
  return {
    project: ([lng, lat]) => ({ x: lng * 10, y: -lat * 10 }),
    unproject: ([x, y]) => ({ lng: x / 10, lat: -y / 10 }),
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) })
  };
}

describe('DroppedRectangles resize', () => {
  it('invokes onResizeRect while dragging a handle', async () => {
    const map = makeMap();
    const placeables = [{ id: 'rect', name: 'Table', geometryType: 'rect', texture: null, units: 'm' }];
    const rect = {
      id: 'r1',
      type: 'rect',
      geometry: { type: 'Polygon', coordinates: [[[0,0],[2,0],[2,1],[0,1],[0,0]]] },
      properties: { dimensions: { width: 2, height: 1 }, rotationDeg: 0 }
    };
    const onResizeRect = vi.fn();
    const ui = render(
      <svg style={{ width: 800, height: 600 }}>
        <foreignObject width="800" height="600">
          <div>
            <DroppedRectangles
              objects={[rect]}
              placeableObjects={placeables}
              map={map}
              objectUpdateTrigger={0}
              selectedId={'r1'}
              onSelectRect={() => {}}
              onResizeRect={onResizeRect}
            />
          </div>
        </foreignObject>
      </svg>
    );

    // Find a handle circle (there are 4 when selected)
    const circles = ui.container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThan(0);
    const handle = circles[0];

    // Mouse down then move
    fireEvent.mouseDown(handle, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 30, clientY: 30 });
    fireEvent.mouseUp(window);

    expect(onResizeRect).toHaveBeenCalled();
    const [id, newGeom] = onResizeRect.mock.calls[0];
    expect(id).toBe('r1');
    expect(newGeom?.type).toBe('Polygon');
  });
});


