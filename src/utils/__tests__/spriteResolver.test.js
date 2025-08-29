import { describe, it, expect } from 'vitest';
import { getCandidateSrcs } from '../../utils/spriteResolver';

describe('spriteResolver.getCandidateSrcs', () => {
  it('returns nested view dir first for enhanced isometric', () => {
    const objectType = {
      id: 'banner',
      name: 'Banner',
      size: { width: 36, height: 36 },
      enhancedRendering: { enabled: true, spriteBase: 'banner', publicDir: '/static/banner/isometric/renders', angles: [0,45,90,135,180,225,270,315] }
    };
    const candidates = getCandidateSrcs(objectType, 90, 'isometric');
    // Flat structure is preferred in refactor
    expect(candidates[0]).toContain('/static/banner/banner_090.png');
  });

  it('returns flat top-down first for enhanced top-down', () => {
    const objectType = {
      id: 'banner',
      name: 'Banner',
      size: { width: 36, height: 36 },
      enhancedRendering: { enabled: true, spriteBase: 'banner', publicDir: '/static/banner/top-down/renders', angles: [0,45,90,135,180,225,270,315] }
    };
    const candidates = getCandidateSrcs(objectType, 0, 'top-down');
    // Flat top-down path should be first
    expect(candidates[0]).toContain('/static/banner/banner_TOP_000.png');
  });

  it('falls back to imageUrl for non-enhanced', () => {
    const objectType = { id: 'chair', name: 'Chair', imageUrl: '/data/icons/isometric-bw/chair_000.png', size: { width: 24, height: 24 } };
    const candidates = getCandidateSrcs(objectType, 135, 'isometric');
    expect(candidates[0]).toBe('/data/icons/isometric-bw/chair_000.png');
  });
});


