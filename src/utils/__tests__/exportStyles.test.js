import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BLUEPRINT_THEME, setPdfFont, mmFromPt, ptFromMm, drawTextWithWipe, drawNorthArrow, drawScaleBar } from '../exportStyles.js';

function makePdfMock() {
  return {
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    getFontSize: vi.fn(() => 12),
    getTextWidth: vi.fn(() => 20),
    setFillColor: vi.fn(),
    rect: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    triangle: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    line: vi.fn()
  };
}

describe('exportStyles', () => {
  it('pt/mm conversions are inverses', () => {
    const mm = 10;
    const pt = ptFromMm(mm);
    expect(Math.abs(mmFromPt(pt) - mm)).toBeLessThan(1e-6);
  });

  it('setPdfFont sets font and size safely', () => {
    const pdf = makePdfMock();
    setPdfFont(pdf, 'heading', BLUEPRINT_THEME.sizesMm.h2);
    expect(pdf.setFont).toHaveBeenCalled();
    expect(pdf.setFontSize).toHaveBeenCalled();
  });

  it('drawTextWithWipe draws background rect and centers text', () => {
    const pdf = makePdfMock();
    drawTextWithWipe(pdf, 'Hello', 50, 60);
    expect(pdf.rect).toHaveBeenCalled();
    expect(pdf.text).toHaveBeenCalledWith('Hello', 50, 60, { align: 'center', baseline: 'middle' });
  });

  it('drawNorthArrow draws triangle and N label', () => {
    const pdf = makePdfMock();
    drawNorthArrow(pdf, 100, 50, 12);
    expect(pdf.triangle).toHaveBeenCalled();
    expect(pdf.text).toHaveBeenCalledWith('N', 100, expect.any(Number), { align: 'center' });
  });

  it('drawScaleBar draws base line, ticks, and label', () => {
    const pdf = makePdfMock();
    drawScaleBar(pdf, 20, 30, 100, 1.2);
    expect(pdf.line).toHaveBeenCalled();
    expect(pdf.text).toHaveBeenCalled();
  });
});


