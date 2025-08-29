import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlaceableObjectsPanel from '../PlaceableObjectsPanel.jsx';

vi.mock('../../../utils/colorUtils', () => ({
  getContrastingBackgroundForIcon: vi.fn(async () => 'rgba(255,255,255,0.9)')
}));

describe('PlaceableObjectsPanel', () => {
  const objects = [
    { id: 'chair', name: 'Chair', imageUrl: '/data/icons/isometric-bw/chair_000.png', color: '#0ea5e9' },
    { id: 'table', name: 'Table', geometryType: 'rect', color: '#10b981' }
  ];

  it('renders objects and triggers activation and rect activation', () => {
    const onActivation = vi.fn();
    const onRectActivation = vi.fn();
    render(
      <PlaceableObjectsPanel
        objects={objects}
        onActivation={onActivation}
        onRectActivation={onRectActivation}
        placementMode={{ objectType: { id: 'chair' }, isBatchMode: false }}
        activeRectObjectTypeId={null}
      />
    );

    // Header and count reflect new layout
    expect(screen.getByText('Event Objects')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Tiles no longer show labels per-object; validate via alt/title
    const chairBtn = screen.getByTitle('Click to place Chair (click again to cancel)');
    const tableBtn = screen.getByTitle('Click to place Table');

    // Click chair -> onActivation
    fireEvent.click(chairBtn);
    expect(onActivation).toHaveBeenCalled();

    // Click table -> onRectActivation
    fireEvent.click(tableBtn);
    expect(onRectActivation).toHaveBeenCalled();
  });
});


