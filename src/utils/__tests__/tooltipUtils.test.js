import { describe, it, expect } from 'vitest';
import { buildTooltipContent, createInfrastructureTooltipContent, highlightSearchTerm } from '../tooltipUtils.js';

describe('tooltipUtils', () => {
  it('buildTooltipContent falls back to string props when named fields absent', () => {
    const out = buildTooltipContent({ foo_bar: 'baz', the_geom: 'x', random: 'val' });
    expect(out).toEqual([
      { label: 'Foo Bar', value: 'baz' },
      { label: 'Random', value: 'val' }
    ]);
  });

  it('createInfrastructureTooltipContent handles hydrants and generic layers', () => {
    const hydrant = createInfrastructureTooltipContent({ unitid: 'H1', status: 'OK', rj_type: 'Std', note: 'X' }, 'hydrants');
    expect(hydrant.find((f) => f.label === 'Hydrant ID')?.value).toBe('H1');

    const generic = createInfrastructureTooltipContent({ a_field: 'A', b_field: 'B' }, 'trees');
    expect(generic).toEqual([
      { label: 'A Field', value: 'A' },
      { label: 'B Field', value: 'B' }
    ]);
  });

  it('highlightSearchTerm returns structured parts', () => {
    const parts = highlightSearchTerm('Hello world', 'lo');
    expect(parts.some(p => p.type === 'highlight')).toBe(true);
  });
});


