import { describe, it, expect } from 'vitest';
import { examples, getExampleBySlug } from '../examples/registry.js';

describe('examples/registry', () => {
  it('returns example by slug and null for unknown', () => {
    const anySlug = examples[0]?.slug;
    if (anySlug) {
      expect(getExampleBySlug(anySlug)).toEqual(examples[0]);
    }
    expect(getExampleBySlug('does-not-exist')).toBeNull();
  });
});


