import { describe, it, expect } from 'vitest';
import { buildTooltipContent, createInfrastructureTooltipContent, highlightSearchTerm } from '../tooltipUtils.js';

describe('tooltipUtils', () => {
  it('buildTooltipContent prioritizes known fields and falls back to strings', () => {
    const props = { name: 'Site A', propertyname: 'Prop', subpropertyname: 'Sub', address: '123 St', zipcode: '10001' };
    const res = buildTooltipContent(props);
    expect(res).toEqual([
      { label: 'Name', value: 'Site A' },
      { label: 'Property', value: 'Prop' },
      { label: 'Sub-Property', value: 'Sub' },
      { label: 'Address', value: '123 St' },
      { label: 'Borough', value: undefined },
      { label: 'Zip Code', value: '10001' }
    ].filter(x => x.value !== undefined));
  });

  it('buildTooltipContent returns up to three generic fields when no known fields present', () => {
    const props = { foo_bar: 'x', baz: 'y', qux: 'z', geometry: 'skip' };
    const res = buildTooltipContent(props);
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].label).toBe('Foo Bar');
  });

  it('createInfrastructureTooltipContent hydrants emits important fields first', () => {
    const props = { unitid: 'H-1', status: 'Active', rj_type: 'TypeA', other_field: 'O' };
    const res = createInfrastructureTooltipContent(props, 'hydrants');
    expect(res[0]).toEqual({ label: 'Hydrant ID', value: 'H-1' });
    expect(res.some(r => r.label === 'Type')).toBe(true);
  });

  it('createInfrastructureTooltipContent busStops selects expected fields', () => {
    const props = { stop_name: 'Main St', stop_id: '123', route_ids: 'Q1', wheelchair_boarding: '1' };
    const res = createInfrastructureTooltipContent(props, 'busStops');
    expect(res.find(r => r.label === 'Stop Name')?.value).toBe('Main St');
  });

  it('highlightSearchTerm splits and marks highlights', () => {
    const parts = highlightSearchTerm('Union Square Park', 'square');
    expect(parts.some(p => p.type === 'highlight' && /Square/i.test(p.text))).toBe(true);
  });
});


