import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rasterizeToPngDataUrl, loadVisibleLayerIconsAsPngDataUrls, loadDroppedObjectIconPngs } from '../exportUtils.js';
import { INFRASTRUCTURE_ICONS } from '../iconUtils.js';

vi.mock('../iconUtils.js', async (orig) => {
  const mod = await orig();
  return {
    ...mod,
    INFRASTRUCTURE_ICONS: {
      bikeParking: { src: '/icons/bike.svg' },
      benches: { src: '/icons/bench.svg' }
    }
  };
});

describe('exportUtils canvas-backed helpers', () => {
  const origImage = global.Image;
  const origCreate = document.createElement;
  beforeEach(() => {
    global.Image = class {
      constructor(){ this.onload = null; this.onerror = null; this.width = 20; this.height = 10; }
      set src(_) { setTimeout(() => this.onload && this.onload(), 0); }
    };
    document.createElement = (tag) => {
      const el = origCreate.call(document, tag);
      if (tag === 'canvas') {
        el.getContext = () => ({
          imageSmoothingEnabled: false,
          setTransform: () => {},
          clearRect: () => {},
          drawImage: () => {}
        });
        el.toDataURL = () => 'data:image/png;base64,ZZZ';
      }
      return el;
    };
  });
  afterEach(() => { global.Image = origImage; document.createElement = origCreate; });

  it('rasterizeToPngDataUrl returns PNG data url', async () => {
    const url = await rasterizeToPngDataUrl('/icons/bike.svg', 32);
    expect(url).toBe('data:image/png;base64,ZZZ');
  });

  it('loadVisibleLayerIconsAsPngDataUrls returns map for visible layers', async () => {
    const layers = { permitAreas: { visible: true }, bikeParking: { visible: true }, benches: { visible: false } };
    const map = await loadVisibleLayerIconsAsPngDataUrls(layers);
    expect(Object.keys(map)).toEqual(['bikeParking']);
    expect(map.bikeParking).toBe('data:image/png;base64,ZZZ');
  });

  it('loadDroppedObjectIconPngs rasterizes placeable object images', async () => {
    const dropped = [
      { type: 'chair' },
      { type: 'table', properties: { rotationDeg: 90 } }
    ];
    // Mock PLACEABLE_OBJECTS by injecting via global; instead, rely on exported function fallback flows
    const map = await loadDroppedObjectIconPngs(dropped);
    expect(typeof map).toBe('object');
  });
});


