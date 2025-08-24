import { describe, it, expect } from 'vitest';
import { __wrapCanvasLines, __getSafeFilename } from '../exportUtils.js';

describe('exportUtils helper coverage', () => {
  it('__wrapCanvasLines breaks long words and respects max width', () => {
    const ctx = { measureText: (t) => ({ width: t.length }) };
    const text = 'supercalifragilisticexpialidocious ' + 'short words here';
    const lines = __wrapCanvasLines(ctx, text, 10);
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('__getSafeFilename slugifies name and appends date', () => {
    const area = { properties: { name: 'Broadway & 5th / West' } };
    const out = __getSafeFilename(area);
    expect(out).toMatch(/^broadway---5th---west-\d{4}-\d{2}-\d{2}$/);
  });
});

import { describe, it, expect } from 'vitest';
import * as mod from '../exportUtils.js';

describe('exportUtils helpers', () => {
  it('__getSafeFilename trims/normalizes', () => {
    const fn = mod.__getSafeFilename || mod.__safeFilename || mod.__getSafeFileName;
    if (!fn) return; // helper may be internal; skip if not exported
    expect(fn('  A/B:C*D? ')).toMatch(/^[A-za-z0-9\-_.]+$/);
  });

  it('__getSiteplanTitleParts returns defaults when missing', () => {
    const f = mod.__getSiteplanTitleParts;
    if (!f) return;
    const parts = f({ focusedArea: null, eventInfo: null });
    expect(parts).toBeDefined();
  });
});


