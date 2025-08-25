import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getMapViewType, VIEW_TYPES, buildSpriteUrl, addEnhancedSpritesToMap } from '../enhancedRenderingUtils.js';

function makeMap(pitch = 0) {
  return { getPitch: vi.fn(() => pitch), hasImage: vi.fn(() => false), addImage: vi.fn() };
}

describe('enhancedRenderingUtils static paths and view type', () => {
  it('getMapViewType defaults to isometric when no map provided', () => {
    expect(getMapViewType(null)).toBe(VIEW_TYPES.ISOMETRIC);
    expect(getMapViewType(undefined)).toBe(VIEW_TYPES.ISOMETRIC);
  });

  it('getMapViewType returns isometric for high pitch and top-down for low pitch', () => {
    expect(getMapViewType(0)).toBe(VIEW_TYPES.TOP_DOWN);
    expect(getMapViewType(60)).toBe(VIEW_TYPES.ISOMETRIC);
    expect(getMapViewType(makeMap(0))).toBe(VIEW_TYPES.TOP_DOWN);
    expect(getMapViewType(makeMap(45))).toBe(VIEW_TYPES.ISOMETRIC);
  });

  it('buildSpriteUrl produces correct paths for both views', () => {
    expect(buildSpriteUrl('banner', 90, VIEW_TYPES.ISOMETRIC)).toBe('/static/banner/isometric/renders/banner_090.png');
    expect(buildSpriteUrl('banner', 90, VIEW_TYPES.TOP_DOWN)).toBe('/static/banner/top-down/renders/banner_TOP_090.png');
  });

  describe('addEnhancedSpritesToMap with custom urlBuilder', () => {
    const urls = [];
    const origImage = global.Image;
    beforeEach(() => {
      urls.length = 0;
      class FakeImage {
        set crossOrigin(_) {}
        set src(v) { urls.push(v); setTimeout(() => this.onload && this.onload(), 0); }
      }
      global.Image = FakeImage;
    });
    afterEach(() => { global.Image = origImage; });

    it('uses urlBuilder and viewType to load top-down sprite', async () => {
      const map = makeMap();
      await addEnhancedSpritesToMap(map, {
        baseName: 'banner',
        publicDir: '/ignored',
        angles: [0],
        viewType: VIEW_TYPES.TOP_DOWN,
        urlBuilder: buildSpriteUrl,
      });
      expect(urls[0]).toBe('/static/banner/top-down/renders/banner_TOP_000.png');
    });
  });
});


