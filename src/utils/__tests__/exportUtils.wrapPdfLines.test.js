import { describe, it, expect } from 'vitest';
import { wrapPdfLines } from '../exportUtils.js';

function makePdfMock({ baseWidthPerChar = 1, fontSize = 10 } = {}) {
  return {
    getFontSize: () => fontSize,
    getTextWidth: (t) => (t ? String(t).length * baseWidthPerChar : 0)
  };
}

describe('exportUtils.wrapPdfLines', () => {
  it('returns empty array for empty text', () => {
    const pdf = makePdfMock();
    expect(wrapPdfLines(pdf, '', 100)).toEqual([]);
    expect(wrapPdfLines(pdf, null, 100)).toEqual([]);
  });

  it('wraps text by words within max width', () => {
    const pdf = makePdfMock({ baseWidthPerChar: 1, fontSize: 10 });
    const text = 'The quick brown fox jumps over the lazy dog';
    const lines = wrapPdfLines(pdf, text, 10 /* mm */);
    // 10 chars per line with this mock
    expect(lines.every((l) => l.length <= 10)).toBe(true);
    expect(lines.join(' ')).toContain('quick');
  });

  it('hard-breaks very long single words', () => {
    const pdf = makePdfMock({ baseWidthPerChar: 2, fontSize: 10 });
    const text = 'Supercalifragilisticexpialidocious';
    const lines = wrapPdfLines(pdf, text, 8 /* mm */);
    // 8 mm / (2 width per char) -> max 4 chars per line
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].length).toBeLessThanOrEqual(4);
  });

  it('respects font size ratio to current font', () => {
    const pdf = makePdfMock({ baseWidthPerChar: 1, fontSize: 20 });
    // If requested font size > current, measured width increases and wraps.
    const lines = wrapPdfLines(pdf, 'abcdefghij', 5 /* mm */, 40);
    expect(lines.length).toBeGreaterThan(1);
  });
});


