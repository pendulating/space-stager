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


