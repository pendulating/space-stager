import { describe, it, expect } from 'vitest';
import { NUDGE_RULES } from '../nudgeRules.js';

describe('NUDGE_RULES integrity', () => {
  it('rules have required fields and valid types', () => {
    NUDGE_RULES.forEach((r) => {
      expect(typeof r.id).toBe('string');
      expect(['proximity','text','object']).toContain(r.type);
      expect(['info','warning']).toContain(r.severity);
      expect(typeof r.message).toBe('string');
    });
  });
});


