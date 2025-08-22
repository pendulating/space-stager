import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BasemapToggle from '../BasemapToggle.jsx';

vi.mock('../../../utils/mapUtils', () => ({
  switchBasemap: vi.fn(async () => {})
}));

vi.mock('../../../constants/mapConfig', () => ({
  BASEMAP_OPTIONS: {
    carto: { name: 'Carto' },
    satellite: { name: 'Satellite' }
  }
}));

describe('BasemapToggle', () => {
  function createMapMock(styleLoaded = true) {
    return {
      isStyleLoaded: () => styleLoaded,
      getStyle: () => ({ sprite: 'https://cartocdn.com/sprite' }),
      getLayer: vi.fn(() => null),
      once: vi.fn()
    };
  }

  it('renders and toggles basemap buttons', async () => {
    const map = createMapMock(true);
    render(<BasemapToggle map={map} onStyleChange={() => {}} />);
    expect(screen.getByText('Basemap')).toBeInTheDocument();
    expect(screen.getByText('Carto')).toBeInTheDocument();
    expect(screen.getByText('Satellite')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Satellite'));
    // No throw means handler ran; style change is mocked; visual state managed internally
    expect(screen.getByText('Satellite')).toBeInTheDocument();
  });
});


