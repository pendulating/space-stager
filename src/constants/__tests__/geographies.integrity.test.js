import { describe, it, expect } from 'vitest';
import { GEOGRAPHIES } from '../geographies.js';

describe('GEOGRAPHIES integrity', () => {
  it('each geography has required shape', () => {
    Object.values(GEOGRAPHIES).forEach((g) => {
      expect(typeof g.idPrefix).toBe('string');
      expect(['polygon','point']).toContain(g.type);
      expect(typeof g.datasetUrl).toBe('string');
      expect(Array.isArray(g.searchKeys)).toBe(true);
    });
  });
});


