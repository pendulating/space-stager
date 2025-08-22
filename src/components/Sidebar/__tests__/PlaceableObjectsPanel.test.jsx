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

    expect(screen.getByText('Chair')).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();

    // Click chair -> onActivation
    fireEvent.click(screen.getByText('Chair').closest('.object-item'));
    expect(onActivation).toHaveBeenCalled();

    // Click table -> onRectActivation
    fireEvent.click(screen.getByText('Table').closest('.object-item'));
    expect(onRectActivation).toHaveBeenCalled();
  });
});


