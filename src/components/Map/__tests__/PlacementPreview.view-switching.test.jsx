import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import PlacementPreview from '../PlacementPreview.jsx';

function makeMap(pitch = 0) {
  return { getPitch: () => pitch };
}

describe('PlacementPreview view switching', () => {
  const objects = [
    { id: 'banner', name: 'Banner', size: { width: 30, height: 30 }, imageUrl: '/img/banner.png', enhancedRendering: { enabled: true, spriteBase: 'banner' } }
  ];

  it('uses isometric path when pitch > 15', () => {
    const { container } = render(
      <PlacementPreview
        placementMode={{ objectType: { id: 'banner' }, isFlipped: false, rotationDeg: 45 }}
        cursorPosition={{ x: 50, y: 50 }}
        placeableObjects={objects}
        map={makeMap(60)}
      />
    );
    const img = container.querySelector('img');
    // With default zero-offset for isometric (-90), 45° becomes 315° sprite
    expect(img.getAttribute('src')).toContain('/static/banner/banner_315.png');
  });

  it('uses top-down path when pitch <= 15', () => {
    const { container } = render(
      <PlacementPreview
        placementMode={{ objectType: { id: 'banner' }, isFlipped: false, rotationDeg: 45 }}
        cursorPosition={{ x: 50, y: 50 }}
        placeableObjects={objects}
        map={makeMap(0)}
      />
    );
    const img = container.querySelector('img');
    expect(img.getAttribute('src')).toContain('/static/banner/banner_TOP_045.png');
  });
});


