import { describe, it, expect } from 'vitest';
import { INFRASTRUCTURE_ENDPOINTS } from '../endpoints.js';
import { INITIAL_LAYERS, LAYER_GROUPS } from '../layers.js';

describe('Constants integrity', () => {
  it('every INITIAL_LAYERS entry with endpoint has a matching INFRASTRUCTURE_ENDPOINTS key', () => {
    const missing = Object.entries(INITIAL_LAYERS)
      .filter(([k, v]) => v?.endpoint)
      .map(([k, v]) => [k, v.endpoint])
      .filter(([k]) => !(k in INFRASTRUCTURE_ENDPOINTS));
    expect(missing, `Missing endpoints for: ${missing.map(m => m[0]).join(', ')}`).toEqual([]);
  });

  it('LAYER_GROUPS only references valid layer keys in INITIAL_LAYERS', () => {
    const invalid = [];
    Object.values(LAYER_GROUPS).forEach(group => {
      (group.layers || []).forEach(layerId => {
        if (!(layerId in INITIAL_LAYERS)) invalid.push(layerId);
      });
    });
    expect(invalid, `Invalid layer ids: ${invalid.join(', ')}`).toEqual([]);
  });
});


