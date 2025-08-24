import { describe, it, expect } from 'vitest';
import { PLACEABLE_OBJECTS } from '../placeableObjects.js';

describe('PLACEABLE_OBJECTS enhancedRendering flags', () => {
  it('objects that declare enhancedRendering.enabled have sprite metadata', () => {
    const withEnhanced = PLACEABLE_OBJECTS.filter(o => o.enhancedRendering?.enabled);
    expect(withEnhanced.length).toBeGreaterThan(0);
    withEnhanced.forEach((o) => {
      expect(typeof o.enhancedRendering.spriteBase).toBe('string');
      expect(typeof o.enhancedRendering.publicDir).toBe('string');
      expect(Array.isArray(o.enhancedRendering.angles)).toBe(true);
      expect(o.enhancedRendering.angles.length).toBeGreaterThan(0);
    });
  });
});


