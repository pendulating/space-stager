import { describe, it, expect } from 'vitest';
import { evaluateNudges } from '../nudgeEngine.js';

describe('nudgeEngine', () => {
  it('produces object nudges for matching dropped objects', () => {
    const rules = [{ id: 'r1', type: 'object', subject: { where: { type: 'chair' } }, message: 'Place ${objectName} carefully', severity: 'info' }];
    const dropped = [{ id: 'o1', type: 'chair', name: 'Folding Chair', position: { lng: -73.9, lat: 40.7 } }];
    const { nudges } = evaluateNudges({ rules, droppedObjects: dropped });
    expect(nudges.length).toBe(1);
    expect(nudges[0].ruleId).toBe('r1');
  });

  it('produces proximity nudges when near infrastructure points', () => {
    const rules = [{ id: 'r2', type: 'proximity', subject: { where: { type: 'table' } }, target: { layerId: 'hydrants' }, thresholdFt: 500, message: 'Too close (${distanceFt}ft < ${thresholdFt}ft)', severity: 'warning' }];
    const dropped = [{ id: 'o2', type: 'table', position: { lng: -73.9857, lat: 40.7484 } }];
    const infrastructureData = {
      hydrants: { features: [{ id: 'h1', geometry: { type: 'Point', coordinates: [-73.9855, 40.7485] }, properties: {} }] }
    };
    const layers = { hydrants: { visible: true } };
    const { nudges } = evaluateNudges({ rules, droppedObjects: dropped, infrastructureData, layers });
    expect(nudges.length).toBe(1);
    expect(nudges[0].type).toBe('proximity');
  });
});


