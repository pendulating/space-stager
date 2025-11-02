import { describe, it, expect, vi } from 'vitest';
import { exportPlan, exportPermitAreaSiteplanV2 } from '../exportUtils.js';

describe('exportUtils guards', () => {
  it('exportPlan returns early when map is missing or features empty', () => {
    // These functions orchestrate many dependencies; here we just ensure no throw on guards
    expect(() => exportPlan(null, null, [], {}, [], {})).not.toThrow();
  });

  it('exportPermitAreaSiteplanV2 handles missing focusedArea gracefully', () => {
    const map = { getCanvas: () => ({ toDataURL: () => 'data:' }), once: () => {}, fire: () => {}, on: () => {} };
    expect(() => exportPermitAreaSiteplanV2(map, null, {}, [], [], 'pdf', null, { noLegend: true }, {})).not.toThrow();
  });
});
