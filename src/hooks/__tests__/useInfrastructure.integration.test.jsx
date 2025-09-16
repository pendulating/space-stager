import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useState, useEffect } from 'react';
import { useInfrastructure } from '../useInfrastructure.js';

// Mock infra service to avoid network
vi.mock('../../services/infrastructureService.js', async (orig) => {
  const mod = await orig();
  return {
    ...mod,
    loadInfrastructureData: vi.fn(async () => ({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { id: 'pt-1' } }
      ]
    }))
  };
});

// No-op sprite additions
vi.mock('../../utils/enhancedRenderingUtils.js', async (orig) => {
  const mod = await orig();
  return {
    ...mod,
    addEnhancedSpritesToMap: vi.fn(async () => {}),
  };
});

// Helper: Fake Map object with minimal API
class FakeMap {
  constructor() {
    this._bearing = 0;
    this._pitch = 0;
    this._listeners = new Map();
    this._sources = new Map();
  }
  on(evt, fn) { const arr = this._listeners.get(evt) || []; arr.push(fn); this._listeners.set(evt, arr); }
  off(evt, fn) { const arr = this._listeners.get(evt) || []; this._listeners.set(evt, arr.filter(f => f !== fn)); }
  once(evt, fn) { const wrap = (...args) => { try { fn(...args); } finally { this.off(evt, wrap); } }; this.on(evt, wrap); }
  emit(evt, ...args) { const arr = this._listeners.get(evt) || []; arr.forEach(fn => fn(...args)); }
  isStyleLoaded() { return true; }
  getBearing() { return this._bearing; }
  setBearing(b) { this._bearing = b; }
  getPitch() { return this._pitch; }
  setPitch(p) { this._pitch = p; }
  getStyle() { return { layers: [] }; }
  addSource(id, def) { this._sources.set(id, { def, data: def?.data, setData: (d) => { this._sources.get(id).data = d; } }); }
  getSource(id) { return this._sources.get(id); }
  addLayer() {}
  getLayer() { return null; }
  setLayoutProperty() {}
  getLayoutProperty() { return null; }
  removeLayer() {}
  removeSource() {}
  project({ lng, lat }) { return { x: lng, y: lat }; }
}

const areaPoly = {
  type: 'Feature',
  properties: { id: 'area-1' },
  geometry: {
    type: 'Polygon',
    coordinates: [[[-0.01,-0.01],[0.01,-0.01],[0.01,0.01],[-0.01,0.01],[-0.01,-0.01]]]
  }
};

const initialLayers = {
  benches: {
    visible: false,
    name: 'Benches',
    color: '#8b5cf6',
    loading: false,
    loaded: false,
    endpoint: '/api/benches',
    enhancedRendering: { enabled: true, spriteBase: 'bench', facingMode: 'awayFromStreet', angles: [0,45,90,135,180,225,270,315] }
  }
};

const Harness = ({ map, autoToggle = true }) => {
  const [layers, setLayers] = useState(initialLayers);
  const infra = useInfrastructure(map, areaPoly, layers, setLayers);
  useEffect(() => {
    if (!autoToggle) return;
    // trigger load
    infra.toggleLayer('benches');
  }, []);
  const firstImg = (() => {
    try {
      const feats = infra.infrastructureData?.benches?.features || [];
      return feats[0]?.properties?.icon_image || '';
    } catch (_) { return ''; }
  })();
  return (
    <div>
      <div data-testid="img">{firstImg}</div>
    </div>
  );
};

describe('useInfrastructure integration', () => {
  let map;
  beforeEach(() => { map = new FakeMap(); });
  afterEach(() => { map = null; });

  it('updates icon_image when bearing crosses 45° bucket, not within same bucket', async () => {
    render(<Harness map={map} />);
    // Allow effect chain to run
    await act(async () => { map.emit('style.load'); map.emit('render'); });

    const getImg = () => screen.getByTestId('img').textContent;
    const initial = getImg();
    expect(typeof initial).toBe('string');

    // Small rotate within same 45° bucket → unchanged
    await act(async () => { map.setBearing(10); map.emit('render'); });
    const withinBucket = getImg();
    expect(withinBucket).toBe(initial);

    // Cross bucket boundary → changed
    await act(async () => { map.setBearing(60); map.emit('render'); });
    const next = getImg();
    expect(next).not.toBe(initial);
  });

  it('re-buckets on pitch change when area orientation changes', async () => {
    // Mock bearingUtils.computeAreaOrientation to return 0 for pitch<=15 else 90
    const bearingMod = await import('../../utils/bearingUtils.js');
    const spy = vi.spyOn(bearingMod, 'computeAreaOrientation').mockImplementation(({ map, geometry, pitch }) => {
      return (pitch && pitch > 15) ? 90 : 0;
    });
    render(<Harness map={map} />);
    await act(async () => { map.emit('style.load'); map.emit('render'); });
    const getImg = () => screen.getByTestId('img').textContent;
    const a = getImg();
    await act(async () => { map.setPitch(60); map.emit('render'); });
    const b = getImg();
    expect(b).not.toBe(a);
    spy.mockRestore();
  });
});


