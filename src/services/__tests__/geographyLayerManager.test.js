import { describe, it, expect, vi } from 'vitest';
import { ensureBaseLayers, setBaseVisibility, unload } from '../geographyLayerManager.js';

function createMockMap() {
  const sources = new Map();
  const layers = new Map();
  const style = { layers: [ { id: 'symbol-0', type: 'symbol' } ] };
  const map = {
    getStyle: () => style,
    addSource: vi.fn((id, src) => { sources.set(id, src); }),
    getSource: vi.fn((id) => sources.get(id)),
    removeSource: vi.fn((id) => { sources.delete(id); }),
    addLayer: vi.fn((layer, beforeId) => { layers.set(layer.id, { ...layer, beforeId }); style.layers.push({ id: layer.id, type: layer.type }); }),
    getLayer: vi.fn((id) => layers.get(id)),
    removeLayer: vi.fn((id) => { layers.delete(id); }),
    moveLayer: vi.fn(),
    setLayoutProperty: vi.fn(),
  };
  return map;
}

describe('geographyLayerManager', () => {
  it('ensureBaseLayers creates polygon layers idempotently', () => {
    const map = createMockMap();
    ensureBaseLayers(map, 'geo', 'polygon');
    ensureBaseLayers(map, 'geo', 'polygon');
    expect(map.getSource('geo')).toBeTruthy();
    expect(map.getLayer('geo-fill')).toBeTruthy();
    expect(map.getLayer('geo-outline')).toBeTruthy();
    expect(map.getLayer('geo-focused-fill')).toBeTruthy();
    expect(map.getLayer('geo-focused-outline')).toBeTruthy();
  });

  it('ensureBaseLayers creates point layers idempotently', () => {
    const map = createMockMap();
    ensureBaseLayers(map, 'pts', 'point');
    ensureBaseLayers(map, 'pts', 'point');
    expect(map.getLayer('pts-points')).toBeTruthy();
    expect(map.getLayer('pts-focused-points')).toBeTruthy();
  });

  it('setBaseVisibility toggles layer layout properties', () => {
    const map = createMockMap();
    ensureBaseLayers(map, 'geo', 'polygon');
    setBaseVisibility(map, 'geo', 'polygon', false);
    expect(map.setLayoutProperty).toHaveBeenCalledWith('geo-fill', 'visibility', 'none');
    expect(map.setLayoutProperty).toHaveBeenCalledWith('geo-outline', 'visibility', 'none');
  });

  it('unload removes layers and source', () => {
    const map = createMockMap();
    ensureBaseLayers(map, 'geo', 'polygon');
    unload(map, 'geo');
    expect(map.getSource('geo')).toBeFalsy();
    expect(map.getLayer('geo-fill')).toBeFalsy();
  });
});


