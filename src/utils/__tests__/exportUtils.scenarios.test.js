import { describe, it, expect } from 'vitest';
import { exportPermitAreaSiteplanV2, exportPlan } from '../exportUtils.js';

describe('exportUtils scenarios', () => {
  const map = { getCanvas: () => ({ toDataURL: () => 'data:' }), once: () => {}, fire: () => {}, on: () => {}, getZoom: () => 18 };

  it('exportPermitAreaSiteplanV2 with legend and subFocus', () => {
    const focusedArea = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0,0],[0.006,0],[0.006,0.006],[0,0.006],[0,0]]] }, properties: {} };
    const layers = {};
    const drawFeatures = [];
    const droppedObjects = [];
    expect(() => exportPermitAreaSiteplanV2(map, focusedArea, layers, drawFeatures, droppedObjects, 'pdf', null, { noLegend: false, subFocusArea: { type: 'Feature', geometry: focusedArea.geometry } }, {})).not.toThrow();
  });

  it('exportPlan handles empty inputs gracefully', () => {
    expect(() => exportPlan(map, null, [], {}, [], {})).not.toThrow();
  });
});
