import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import DroppedObjects from '../DroppedObjects.jsx';
import { DroppedObjectsProvider } from '../../../contexts/DroppedObjectsContext.jsx';

function makeMap() {
  return {
    project: vi.fn(([lng, lat]) => ({ x: lng, y: lat })),
    on: vi.fn(),
    off: vi.fn(),
    getZoom: () => 18
  };
}

describe('DroppedObjects additional branches (plan-added)', () => {
  it('renders without crashing with minimal props', () => {
    const map = makeMap();
    const { container } = render(
      <DroppedObjectsProvider>
        <DroppedObjects map={map} objects={[]} debug={false} />
      </DroppedObjectsProvider>
    );
    expect(container.firstChild).toBeTruthy();
  });
});


