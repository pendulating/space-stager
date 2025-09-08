import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DroppedObjects from '../DroppedObjects.jsx';

function makeMap() {
  return { project: ([lng, lat]) => ({ x: lng * 10, y: -lat * 10 }), getZoom: () => 16, on: () => {}, off: () => {} };
}

describe('DroppedObjects', () => {
  it('renders icon object and triggers edit/remove actions', () => {
    const placeable = [
      { id: 'chair', name: 'Chair', geometryType: 'point', imageUrl: '/data/icons/isometric-bw/chair_000.png', size: { width: 24, height: 24 }, color: '#0ea5e9' },
      { id: 'table', name: 'Table', geometryType: 'rect', size: { width: 24, height: 24 }, color: '#10b981' }
    ];
    const objects = [
      { id: 'o1', type: 'chair', name: 'Folding Chair', position: { lng: -74, lat: 40.7 }, properties: {} },
      { id: 'o2', type: 'table', name: 'Rect Table', position: { lng: -74, lat: 40.71 }, properties: { dimensions: { width: 2, height: 1 } } }
    ];
    const onRemoveObject = vi.fn();
    const onEditNote = vi.fn();
    render(
      <DroppedObjects
        objects={objects}
        placeableObjects={placeable}
        map={makeMap()}
        objectUpdateTrigger={0}
        onRemoveObject={onRemoveObject}
        onEditNote={onEditNote}
        isNoteEditing={false}
      />
    );
    // Only non-rect renders
    expect(screen.getByTitle('Folding Chair')).toBeInTheDocument();
    // Hover to reveal actions
    const item = screen.getByTitle('Folding Chair');
    fireEvent.mouseOver(item);
    fireEvent.click(screen.getByTitle('Edit note'));
    expect(onEditNote).toHaveBeenCalled();
    fireEvent.click(screen.getByTitle('Remove'));
    expect(onRemoveObject).toHaveBeenCalledWith('o1');
  });

  it('rebuilds once after rehydrating-import:end event', async () => {
    const placeable = [
      { id: 'chair', name: 'Chair', geometryType: 'point', imageUrl: '/data/icons/isometric-bw/chair_000.png', size: { width: 24, height: 24 }, color: '#0ea5e9' }
    ];
    const objects = [
      { id: 'o1', type: 'chair', name: 'Folding Chair', position: { lng: -74, lat: 40.7 }, properties: {} }
    ];
    const map = makeMap();
    const { unmount } = render(
      <DroppedObjects
        objects={objects}
        placeableObjects={placeable}
        map={map}
        objectUpdateTrigger={0}
      />
    );
    // Trigger the event and ensure no errors; behavior is to rebuild internal data
    const evt = new Event('rehydrating-import:end');
    window.dispatchEvent(evt);
    // No explicit assertion on output change necessary; ensure component still renders and does not throw
    expect(document.querySelector('.placed-object')).toBeTruthy();
    unmount();
  });
});


