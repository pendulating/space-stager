import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import DroppedRectanglesMapLibre from '../DroppedRectanglesMapLibre.jsx';

function makeMapWithStyle({ hasDroppedSymbol = true } = {}) {
  const styleLayers = hasDroppedSymbol
    ? [{ id: 'some-layer' }, { id: 'dropped-objects-symbol' }, { id: 'later-layer' }]
    : [{ id: 'permit-areas' }];

  const sources = new Map();
  const addSource = (id, def) => { sources.set(id, def); };
  const getSource = (id) => sources.get(id) || null;
  const addLayerCalls = [];
  return {
    isStyleLoaded: () => true,
    getStyle: () => ({ layers: styleLayers }),
    getLayer: (id) => styleLayers.find(l => l.id === id) || null,
    addSource,
    getSource,
    addLayer: (layer, beforeId) => addLayerCalls.push([layer, beforeId]),
    on: () => {},
    off: () => {},
    hasImage: () => false,
    addImage: () => {},
    project: ([lng, lat]) => ({ x: lng, y: lat }),
    __addLayerCalls: addLayerCalls
  };
}

describe('DroppedRectanglesMapLibre style init', () => {
  it('adds sources and layers with beforeId under dropped-objects-symbol', () => {
    const map = makeMapWithStyle({ hasDroppedSymbol: true });
    // No rectangles needed for init layering, pass empty arrays
    render(<DroppedRectanglesMapLibre map={map} objects={[]} placeableObjects={[]} />);
    // Verify sources added
    expect(map.getSource('dropped-rectangles')).toBeTruthy();
    expect(map.getSource('dropped-rectangles-handles')).toBeTruthy();
    expect(map.getSource('dropped-rectangles-labels')).toBeTruthy();
    // Verify at least one addLayer call used the expected beforeId
    const beforeIds = map.__addLayerCalls.map(([, before]) => before);
    expect(beforeIds).toContain('dropped-objects-symbol');
    // Verify our primary layer ids show up
    const layerIds = map.__addLayerCalls.map(([l]) => l && l.id);
    expect(layerIds).toContain('dropped-rectangles-fill');
    expect(layerIds).toContain('dropped-rectangles-line');
  });
});


