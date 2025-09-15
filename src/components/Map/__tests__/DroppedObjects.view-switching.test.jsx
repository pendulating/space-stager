import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import DroppedObjects from '../DroppedObjects.jsx';
import { DroppedObjectsProvider } from '../../../contexts/DroppedObjectsContext.jsx';

function makeMap(pitch = 0) {
  return {
    project: ([lng, lat]) => ({ x: lng * 10, y: -lat * 10 }),
    getZoom: () => 16,
    getPitch: () => pitch,
  };
}

describe('DroppedObjects view switching', () => {
  const placeable = [
    {
      id: 'banner',
      name: 'Banner',
      geometryType: 'point',
      imageUrl: '/img/banner.png',
      size: { width: 24, height: 24 },
      color: '#0ea5e9',
      enhancedRendering: { enabled: true, spriteBase: 'banner' }
    }
  ];
  const objects = [
    { id: 'o1', type: 'banner', name: 'Banner', position: { lng: -74, lat: 40.7 }, properties: { rotationDeg: 90 } },
  ];

  it('uses isometric path when pitch > 15', () => {
    const { container } = render(
      <DroppedObjectsProvider>
        <DroppedObjects
          objects={objects}
          placeableObjects={placeable}
          map={makeMap(60)}
          objectUpdateTrigger={0}
        />
      </DroppedObjectsProvider>
    );
    const img = container.querySelector('img');
    // With isometric zero-offset (-90), 90° becomes 000° sprite
    expect(img.getAttribute('src')).toContain('/static/banner/banner_000.png');
  });

  it('uses top-down path when pitch <= 15', () => {
    const { container } = render(
      <DroppedObjectsProvider>
        <DroppedObjects
          objects={objects}
          placeableObjects={placeable}
          map={makeMap(0)}
          objectUpdateTrigger={0}
        />
      </DroppedObjectsProvider>
    );
    const img = container.querySelector('img');
    expect(img.getAttribute('src')).toContain('/static/banner/banner_TOP_090.png');
  });
});
