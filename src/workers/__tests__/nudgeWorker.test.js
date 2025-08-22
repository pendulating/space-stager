import { describe, it, expect } from 'vitest';
import workerApi from '../nudgeWorker.js';

describe('nudgeWorker API', () => {
  it('initializes with rules and returns nudges for dropped objects', () => {
    const init = workerApi.initIndexes({ rules: [{ id: 'r1' }] });
    expect(init.ok).toBe(true);
    expect(init.ruleCount).toBe(1);

    const { nudges } = workerApi.evaluate({
      droppedObjects: [
        { id: 'o1', type: 'bench', position: { lng: -73.99, lat: 40.7 } },
        { id: 'o2', type: 'banner', position: { lng: -73.98, lat: 40.71 } },
      ],
      infrastructureData: {},
      layers: {},
    });
    expect(nudges.length).toBe(2);
    expect(nudges[0]).toMatchObject({ subject: { type: 'bench' } });
  });

  it('returns empty nudges if no rules are initialized', () => {
    // Re-init with no rules
    workerApi.initIndexes({ rules: [] });
    const { nudges } = workerApi.evaluate({ droppedObjects: [ { id: 'o1', type: 'bench', position: { lng: 0, lat: 0 } } ] });
    expect(nudges).toEqual([]);
  });
});


