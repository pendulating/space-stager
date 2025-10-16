import { describe, it, expect, vi } from 'vitest';
import { hexToRgb, rgbaString } from '../colorUtils.js';
import * as colorUtils from '../colorUtils.js';

describe('colorUtils', () => {
  it('hexToRgb parses 6-digit hex', () => {
    expect(hexToRgb('#112233')).toEqual({ r: 17, g: 34, b: 51 });
    expect(hexToRgb('112233')).toEqual({ r: 17, g: 34, b: 51 });
  });

  it('hexToRgb parses 3-digit hex', () => {
    expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });
  });

  it('hexToRgb returns null on invalid', () => {
    expect(hexToRgb('#12')).toBeNull();
    expect(hexToRgb('#zzzzzz')).toBeNull();
    expect(hexToRgb(null)).toBeNull();
  });

  it('rgbaString clamps alpha and formats', () => {
    expect(rgbaString({ r: 1, g: 2, b: 3 }, 0.5)).toBe('rgba(1, 2, 3, 0.5)');
    expect(rgbaString({ r: 1, g: 2, b: 3 }, -1)).toBe('rgba(1, 2, 3, 0)');
    expect(rgbaString({ r: 1, g: 2, b: 3 }, 2)).toBe('rgba(1, 2, 3, 1)');
  });

  it('isImageLight returns false on empty src and in server env', async () => {
    expect(await colorUtils.isImageLight('')).toBe(false);
    const originalDocument = globalThis.document;
    // Temporarily simulate server environment
    // eslint-disable-next-line no-global-assign
    globalThis.document = undefined;
    try {
      expect(await colorUtils.isImageLight('anything')).toBe(false);
    } finally {
      // eslint-disable-next-line no-global-assign
      globalThis.document = originalDocument;
    }
  });

  it('isImageLight computes luminance and caches result (bright image)', async () => {
    const originalCreateElement = document.createElement;
    const originalImage = globalThis.Image;

    let getImageDataCalls = 0;

    document.createElement = (tag) => {
      if (tag !== 'canvas') return originalCreateElement.call(document, tag);
      const ctx = {
        drawImage: () => {},
        getImageData: () => {
          getImageDataCalls += 1;
          // 4 pixels of pure white, fully opaque
          const data = new Uint8ClampedArray([
            255, 255, 255, 255,
            255, 255, 255, 255,
            255, 255, 255, 255,
            255, 255, 255, 255,
          ]);
          return { data };
        }
      };
      return {
        width: 0,
        height: 0,
        getContext: () => ctx
      };
    };

    class MockImage {
      constructor() {
        this.width = 4;
        this.height = 4;
        this.onload = null;
        this.onerror = null;
        this.crossOrigin = '';
      }
      set src(v) {
        this._src = v;
        Promise.resolve().then(() => this.onload && this.onload());
      }
    }
    // eslint-disable-next-line no-global-assign
    globalThis.Image = MockImage;

    try {
      const src = 'mock://bright';
      expect(await colorUtils.isImageLight(src)).toBe(true);
      // Second call should come from cache (no additional getImageData call)
      expect(await colorUtils.isImageLight(src)).toBe(true);
      expect(getImageDataCalls).toBe(1);
    } finally {
      document.createElement = originalCreateElement;
      // eslint-disable-next-line no-global-assign
      globalThis.Image = originalImage;
    }
  });

  it('getContrastingBackgroundForIcon returns rgba using fallback when image is light', async () => {
    // Avoid microtasks timing; rely on canvas/Image stubs
    const originalCreateElement = document.createElement;
    const originalImage = globalThis.Image;
    document.createElement = (tag) => {
      if (tag !== 'canvas') return originalCreateElement.call(document, tag);
      return { getContext: () => ({ getImageData: () => ({ data: new Uint8ClampedArray([255,255,255,255]) }), drawImage: () => {} }), width: 1, height: 1 };
    };
    class MockImage { set src(_) { Promise.resolve().then(() => this.onload && this.onload()); } }
    // eslint-disable-next-line no-global-assign
    globalThis.Image = MockImage;
    try {
      const rgba = await colorUtils.getContrastingBackgroundForIcon('any', '#123456', 0.9);
      expect(rgba).toBe('rgba(18, 52, 86, 0.9)');
    } finally {
      document.createElement = originalCreateElement;
      // eslint-disable-next-line no-global-assign
      globalThis.Image = originalImage;
    }
  });

  it('getContrastingBackgroundForIcon falls back to white when image is dark', async () => {
    const originalCreateElement = document.createElement;
    const originalImage = globalThis.Image;
    document.createElement = (tag) => {
      if (tag !== 'canvas') return originalCreateElement.call(document, tag);
      // Very dark pixel
      return { getContext: () => ({ getImageData: () => ({ data: new Uint8ClampedArray([0,0,0,255]) }), drawImage: () => {} }), width: 1, height: 1 };
    };
    class MockImage { set src(_) { Promise.resolve().then(() => this.onload && this.onload()); } }
    // eslint-disable-next-line no-global-assign
    globalThis.Image = MockImage;
    try {
      const rgba = await colorUtils.getContrastingBackgroundForIcon('mock://dark', '#abcdef', 0.9);
      expect(rgba).toBe('rgba(255, 255, 255, 0.9)');
    } finally {
      document.createElement = originalCreateElement;
      // eslint-disable-next-line no-global-assign
      globalThis.Image = originalImage;
    }
  });
});


