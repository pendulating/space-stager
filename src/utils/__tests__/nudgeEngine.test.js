import { describe, it, expect } from 'vitest';
import { evaluateNudges } from '../nudgeEngine.js';

describe('nudgeEngine', () => {
  it('emits object-type nudges for matching dropped objects', () => {
    const rules = [
      { id: 'r-object', type: 'object', subject: { where: { type: 'chair' } }, message: 'Place ${objectName}', severity: 'info' }
    ];
    const droppedObjects = [
      { id: 'd1', type: 'chair', name: 'Folding Chair', position: { lng: -74.0, lat: 40.7 } },
      { id: 'd2', type: 'table', name: 'Table', position: { lng: -73.99, lat: 40.71 } }
    ];
    const { nudges } = evaluateNudges({ rules, droppedObjects });
    expect(nudges.length).toBe(1);
    expect(nudges[0]).toMatchObject({ ruleId: 'r-object', type: 'object' });
  });

  it('emits proximity nudges when within threshold and respects layer visibility', () => {
    const rules = [
      {
        id: 'r-prox',
        type: 'proximity',
        subject: { where: { type: 'chair' } },
        target: { layerId: 'hydrants' },
        thresholdFt: 1000,
        message: 'Too close (${distanceFt} < ${thresholdFt})',
        severity: 'warning'
      }
    ];
    const droppedObjects = [
      { id: 'd1', type: 'chair', position: { lng: -74.0, lat: 40.7 } }
    ];
    const layers = { hydrants: { visible: true } };
    const infrastructureData = {
      hydrants: {
        features: [
          { id: 'h1', type: 'Feature', geometry: { type: 'Point', coordinates: [-74.0005, 40.7005] }, properties: {} }
        ]
      }
    };
    const { nudges } = evaluateNudges({ rules, droppedObjects, layers, infrastructureData });
    expect(nudges.length).toBe(1);
    expect(nudges[0]).toMatchObject({ ruleId: 'r-prox', type: 'proximity' });

    // If layer is not visible, there should be no proximity nudge
    const { nudges: none } = evaluateNudges({ rules, droppedObjects, layers: { hydrants: { visible: false } }, infrastructureData });
    expect(none.length).toBe(0);
  });
});


