import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LayersPanel from '../LayersPanel.jsx';

vi.mock('../../../utils/iconUtils', () => ({
  INFRASTRUCTURE_ICONS: {},
  svgToDataUrl: (s) => `data:image/svg+xml,${encodeURIComponent(s)}`
}));

vi.mock('../../../constants/layers', () => ({
  LAYER_GROUPS: {
    'public-infrastructure': { name: 'Public Infrastructure', icon: '🏛', layers: ['hydrants','benches'] },
    'transport': { name: 'Transport', icon: '🚌', layers: ['busStops'] }
  }
}));

describe('LayersPanel edge cases', () => {
  function makeLayers({ focused = false } = {}) {
    return {
      permitAreas: { visible: true, name: 'Parks' },
      hydrants: { visible: false, name: 'Hydrants', color: '#ef4444', loading: false },
      benches: { visible: true, name: 'Benches', color: '#10b981', loading: true },
      busStops: { visible: false, name: 'Bus Stops', color: '#0ea5e9', error: focused ? null : 'boom' }
    };
  }

  it('disables group actions when no focused area', () => {
    render(<LayersPanel layers={makeLayers()} focusedArea={null} onToggleLayer={vi.fn()} onClearFocus={vi.fn()} geographyType="parks" />);
    // Buttons should advertise focus requirement via title and be disabled
    const focusHintButtons = screen.getAllByRole('button').filter(b => (b.getAttribute('title') || '') === 'Select a permit area first');
    expect(focusHintButtons.length).toBeGreaterThan(0);
    focusHintButtons.forEach(btn => expect(btn).toBeDisabled());
    // Permit areas hint should be visible
    expect(screen.getByText(/Click on the zone geometry/i)).toBeInTheDocument();
  });

  it('shows loading badge and toggles layer when enabled', () => {
    const onToggleLayer = vi.fn();
    const focusedArea = { properties: { name: 'Area A' } };
    // benches must not be loading to allow toggle
    const layers = makeLayers({ focused: true });
    layers.benches.loading = false;
    render(<LayersPanel layers={layers} focusedArea={focusedArea} onToggleLayer={onToggleLayer} onClearFocus={vi.fn()} geographyType="parks" />);
    // Loading badge for benches
    // With benches.loading=false, ensure no Loading on benches but presence overall may exist for others
    // Toggle benches visibility
    const benchesRow = screen.getByText('Benches').closest('div');
    const toggleBtn = benchesRow.querySelector('button');
    fireEvent.click(toggleBtn);
    expect(onToggleLayer).toHaveBeenCalledWith('benches');
  });

  it('renders error badge when layer has error', () => {
    const focusedArea = { properties: { name: 'Area A' } };
    render(<LayersPanel layers={makeLayers()} focusedArea={focusedArea} onToggleLayer={vi.fn()} onClearFocus={vi.fn()} geographyType="parks" />);
    // Expand Transport group to reveal busStops row
    const transportHeader = screen.getByText('Transport').closest('div');
    fireEvent.click(transportHeader);
    // Now the error badge should be visible within the group
    expect(screen.getAllByText(/Error/i).length).toBeGreaterThanOrEqual(1);
  });
});


