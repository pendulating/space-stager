import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LayersPanel from '../LayersPanel.jsx';

vi.mock('../../../utils/iconUtils', () => ({
  INFRASTRUCTURE_ICONS: {},
  svgToDataUrl: (s) => `data:image/svg+xml,${encodeURIComponent(s)}`
}));

const focusedArea = {
  properties: { name: 'Area A' },
  geometry: { type: 'Polygon', coordinates: [[[0,0],[0,1],[1,1],[1,0],[0,0]]] }
};

function makeLayers() {
  return {
    permitAreas: { visible: true, name: 'Parks' },
    bikeParking: { visible: false, name: 'Bike Parking', color: '#0ea5e9' },
    benches: { visible: false, name: 'Benches', color: '#10b981' }
  };
}

// minimal group config for the test
vi.mock('../../../constants/layers', async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    LAYER_GROUPS: {
      'public-infrastructure': {
        name: 'Public Infrastructure',
        icon: 'PI',
        layers: ['bikeParking', 'benches']
      }
    }
  };
});

describe('LayersPanel', () => {
  it('renders permitAreas and group header, and toggles a single layer', () => {
    const onToggleLayer = vi.fn();
    render(<LayersPanel layers={makeLayers()} focusedArea={focusedArea} onToggleLayer={onToggleLayer} onClearFocus={vi.fn()} geographyType="parks" />);

    // Permit areas row visible
    expect(screen.getByText('Parks')).toBeInTheDocument();
    // Group header present
    expect(screen.getByText('Public Infrastructure')).toBeInTheDocument();

    // Expand group
    fireEvent.click(screen.getByText('Public Infrastructure'));

    // Toggle a layer
    const buttons = screen.getAllByRole('button');
    // The first layer toggle after expansion should be in the list; find one with title or by order
    // Click the first toggle icon inside layer item area by searching Eye/EyeOff svg parent button
    const layerToggle = buttons.find(b => b.querySelector('svg'));
    fireEvent.click(layerToggle);
    expect(onToggleLayer).toHaveBeenCalled();
  });

  it('clicking group eye toggles all layers in the group', () => {
    const onToggleLayer = vi.fn();
    render(<LayersPanel layers={makeLayers()} focusedArea={focusedArea} onToggleLayer={onToggleLayer} onClearFocus={vi.fn()} geographyType="parks" />);
    // Group eye button is the button within the header with title matching Show/Hide
    const groupBtn = screen.getByTitle(/Show all public infrastructure/i);
    fireEvent.click(groupBtn);
    expect(onToggleLayer).toHaveBeenCalledTimes(2); // bikeParking and benches
  });
});


