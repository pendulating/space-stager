import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getIconDataUrl, layerUsesPngIcon, getZoomIndependentIconSize, addIconsToMap } from '../iconUtils.js';

describe('iconUtils', () => {
  it('getIconDataUrl returns URL for png types and null for unknown', () => {
    expect(getIconDataUrl('trees')).toMatch(/^\/data\//);
    expect(getIconDataUrl('unknown-layer')).toBeNull();
  });

  it('layerUsesPngIcon reflects configuration', () => {
    expect(layerUsesPngIcon('trees')).toBe(true);
    expect(layerUsesPngIcon('unknown-layer')).toBeFalsy();
  });

  it('getZoomIndependentIconSize returns a MapLibre expression', () => {
    const expr = getZoomIndependentIconSize(0.8);
    expect(Array.isArray(expr)).toBe(true);
    expect(expr[0]).toBe('interpolate');
  });

  it('addIconsToMap returns false when map style not loaded', () => {
    const map = { isStyleLoaded: () => false };
    expect(addIconsToMap(map)).toBe(false);
  });

  it('addIconsToMap attempts to add missing images when style loaded', () => {
    // Mock Image to call onload immediately
    const realImage = global.Image;
    class MockImage {
      set src(_) {
        setTimeout(() => this.onload && this.onload());
      }
    }
    global.Image = MockImage;

    const added = new Set();
    const map = {
      isStyleLoaded: () => true,
      hasImage: (id) => added.has(id),
      addImage: (id, _) => added.add(id),
      removeImage: (id) => added.delete(id)
    };

    const ok = addIconsToMap(map, ['trees']);
    expect(ok).toBe(true);

    // Restore
    global.Image = realImage;
  });
});


