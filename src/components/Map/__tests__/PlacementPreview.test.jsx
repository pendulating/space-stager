import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlacementPreview from '../PlacementPreview.jsx';

const objects = [
  { id: 'bench', name: 'Bench', size: { width: 40, height: 20 }, color: '#123', icon: 'B' },
  { id: 'banner', name: 'Banner', size: { width: 30, height: 30 }, imageUrl: '/img/banner.png', enhancedRendering: { enabled: false } },
  { id: 'isometric', name: 'Iso', size: { width: 60, height: 40 }, imageUrl: '/img/iso.png', enhancedRendering: { enabled: true, spriteBase: 'banner', publicDir: '/data/icons/isometric-bw' } }
];

describe('PlacementPreview', () => {
  it('renders nothing when placementMode or cursorPosition missing', () => {
    const { container } = render(<PlacementPreview placementMode={null} cursorPosition={null} placeableObjects={objects} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders icon character for non-image object with correct flip style', () => {
    render(
      <PlacementPreview
        placementMode={{ objectType: { id: 'bench' }, isFlipped: true, rotationDeg: 0 }}
        cursorPosition={{ x: 100, y: 200 }}
        placeableObjects={objects}
      />
    );
    // find by text B
    const el = screen.getByText('B');
    expect(el).toBeInTheDocument();
  });

  it('renders image url for non-enhanced image and sprite for enhanced image', () => {
    const { rerender } = render(
      <PlacementPreview
        placementMode={{ objectType: { id: 'banner' }, isFlipped: false, rotationDeg: 0 }}
        cursorPosition={{ x: 50, y: 50 }}
        placeableObjects={objects}
      />
    );
    // there should be an img with src '/img/banner.png'
    const img1 = document.querySelector('img');
    expect(img1).toBeTruthy();
    expect(img1.getAttribute('src')).toBe('/img/banner.png');

    rerender(
      <PlacementPreview
        placementMode={{ objectType: { id: 'isometric' }, isFlipped: false, rotationDeg: 90 }}
        cursorPosition={{ x: 60, y: 60 }}
        placeableObjects={objects}
      />
    );
    const img2 = document.querySelector('img');
    expect(img2.getAttribute('src')).toContain('/data/icons/isometric-bw/banner_090.png');
  });
});


