import { describe, it, expect, vi } from 'vitest';
import { switchBasemap } from '../mapUtils.js';

function createMapMock() {
  const layers = new Map();
  const sources = new Map();
  const layout = new Map();
  const style = { layers: [] };
  return {
    getCenter: () => ({ lng: -74, lat: 40.7 }),
    getZoom: () => 12,
    getBearing: () => 0,
    getPitch: () => 0,
    getStyle: () => style,
    getLayer: (id) => layers.get(id),
    addLayer: vi.fn((layer, beforeId) => { layers.set(layer.id, layer); style.layers.push({ id: layer.id, type: layer.type }); }),
    removeLayer: vi.fn((id) => { layers.delete(id); style.layers = style.layers.filter(l => l.id !== id); }),
    getSource: (id) => sources.get(id),
    addSource: vi.fn((id, src) => { sources.set(id, src); }),
    removeSource: vi.fn((id) => { sources.delete(id); }),
    setLayoutProperty: vi.fn((id, prop, value) => { layout.set(id, value); }),
    getLayoutProperty: vi.fn((id) => layout.get(id) || 'visible'),
    once: vi.fn((evt, handler) => { setTimeout(handler, 0); }),
    off: vi.fn(),
    setStyle: vi.fn()
  };
}

describe('mapUtils - satellite overlay path', () => {
  it('adds satellite layer and hides base layers; restores on carto', async () => {
    const map = createMapMock();
    // seed some base layers
    map.getStyle().layers.push({ id: 'background', type: 'background' }, { id: 'land', type: 'fill' }, { id: 'road', type: 'line' }, { id: 'label', type: 'symbol' });

    await switchBasemap(map, 'satellite');
    expect(map.addSource).toHaveBeenCalledWith('nyc-satellite', expect.any(Object));
    expect(map.addLayer).toHaveBeenCalled();
    // Some base layers should be hidden
    expect(map.getLayoutProperty('land')).toBe('none');
    expect(map.getLayoutProperty('road')).toBe('none');

    await switchBasemap(map, 'carto');
    // Satellite removed
    expect(map.getLayer('nyc-satellite-layer')).toBeUndefined();
  });
});


