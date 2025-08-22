import { describe, it, expect } from 'vitest';
import { buildTooltipContent, createInfrastructureTooltipContent, highlightSearchTerm } from '../tooltipUtils.js';

describe('tooltipUtils extra branches', () => {
  it('buildTooltipContent falls back to generic string props', () => {
    const props = { random_field: 'value', another_field: 'text', the_geom: 'hidden' };
    const fields = buildTooltipContent(props);
    expect(fields).not.toBeNull();
    expect(fields[0].label).toBe('Random Field');
  });

  it('createInfrastructureTooltipContent picks hydrants priority fields', () => {
    const props = { unitid: 'H1', status: 'Active', rj_type: 'A', foo_bar: 'baz' };
    const fields = createInfrastructureTooltipContent(props, 'hydrants');
    expect(fields.find(f => f.label === 'Hydrant ID')?.value).toBe('H1');
    expect(fields.length).toBeGreaterThan(1);
  });

  it('highlightSearchTerm returns structured parts', () => {
    const parts = highlightSearchTerm('Hello world', 'wor');
    expect(Array.isArray(parts)).toBe(true);
    expect(parts.some(p => p.type === 'highlight')).toBe(true);
  });
});


