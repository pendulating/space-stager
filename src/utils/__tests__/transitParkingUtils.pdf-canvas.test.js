import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  drawParkingFeatureLabelsOnPdf,
  drawParkingFeatureLabelsOnCanvas,
  drawBusStopFeatureLabelsOnPdf,
  drawBusStopFeatureLabelsOnCanvas,
  drawParkingSignsSummaryPage,
  drawParkingMetersSummaryPage,
  drawParkingAndTransitPage,
} from '../transitParkingUtils.js';

vi.mock('jspdf-autotable', () => ({
  default: (pdf, opts) => {
    // emulate jspdf-autotable attaching lastAutoTable
    pdf.lastAutoTable = { finalY: (opts?.startY ?? 10) + 10 };
  }
}));

describe('transitParkingUtils PDF and canvas drawing', () => {
  const makePdf = () => {
    const calls = [];
    const pdf = {
      calls,
      addPage: vi.fn((...a) => calls.push(['addPage', ...a])),
      setTextColor: vi.fn(),
      setFontSize: vi.fn(),
      getFontSize: vi.fn(() => 10),
      getTextWidth: vi.fn(() => 20),
      setFillColor: vi.fn(),
      setDrawColor: vi.fn(),
      rect: vi.fn(),
      line: vi.fn(),
      lines: vi.fn(),
      circle: vi.fn(),
      text: vi.fn(),
      lastAutoTable: { finalY: 10 },
    };
    return pdf;
  };

  const ctx = () => ({
    save: vi.fn(), restore: vi.fn(),
    textAlign: 'center', textBaseline: 'middle', font: 'bold 11px Arial',
    measureText: (t) => ({ width: String(t).length * 6 }),
    fillRect: vi.fn(), strokeRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
  });

  const offscreen = {
    project: ([lng, lat]) => ({ x: (lng + 180) * 2, y: (90 - lat) * 2 })
  };

  const toMm = (pt) => pt; // identity for tests
  const project = (lng, lat) => ({ x: lng, y: lat });

  it('drawParkingFeatureLabelsOnPdf draws label boxes', () => {
    const pdf = makePdf();
    const features = [{ index: 1, lng: -74, lat: 40.7 }];
    drawParkingFeatureLabelsOnPdf(pdf, project, toMm, features, 'P');
    expect(pdf.rect).toHaveBeenCalled();
    expect(pdf.text).toHaveBeenCalled();
  });

  it('drawBusStopFeatureLabelsOnPdf draws label boxes', () => {
    const pdf = makePdf();
    const features = [{ index: 1, lng: -74, lat: 40.7 }];
    drawBusStopFeatureLabelsOnPdf(pdf, project, toMm, features, 'B');
    expect(pdf.rect).toHaveBeenCalled();
    expect(pdf.text).toHaveBeenCalled();
  });

  it('drawParkingFeatureLabelsOnCanvas draws filled boxes and text', () => {
    const c = ctx();
    const originPx = { x: 0, y: 0 };
    const features = [{ index: 1, lng: -74, lat: 40.7 }];
    drawParkingFeatureLabelsOnCanvas(c, offscreen, originPx, features, 'P');
    expect(c.fillRect).toHaveBeenCalled();
    expect(c.fillText).toHaveBeenCalled();
  });

  it('drawBusStopFeatureLabelsOnCanvas draws boxes and text', () => {
    const c = ctx();
    const originPx = { x: 0, y: 0 };
    const features = [{ index: 1, lng: -74, lat: 40.7 }];
    drawBusStopFeatureLabelsOnCanvas(c, offscreen, originPx, features, 'B');
    expect(c.fillRect).toHaveBeenCalled();
    expect(c.fillText).toHaveBeenCalled();
  });

  it('drawParkingSignsSummaryPage paginates when rows exceed page height', () => {
    const pdf = makePdf();
    const signs = Array.from({ length: 60 }).map((_, i) => ({
      index: i + 1,
      props: { order_number: String(i), on_street: 'Main', from_street: 'A', to_street: 'B', side_of_street: 'N', sign_description: 'Desc' }
    }));
    drawParkingSignsSummaryPage(pdf, signs);
    expect(pdf.addPage).toHaveBeenCalled();
  });

  it('drawParkingMetersSummaryPage paginates when rows exceed page height', () => {
    const pdf = makePdf();
    const meters = Array.from({ length: 60 }).map((_, i) => ({
      index: i + 1,
      props: { on_street: 'Main', from_street: 'A', to_street: 'B', side_of_street: 'N', meter_number: 'X', status: 'OK', meter_hours: '9-5', parking_facility_name: 'Lot' }
    }));
    drawParkingMetersSummaryPage(pdf, meters);
    expect(pdf.addPage).toHaveBeenCalled();
  });

  it('drawParkingAndTransitPage adds a page and calls autotable sections for non-empty data', () => {
    const pdf = makePdf();
    const regs = [{ index: 1, props: {} }];
    const meters = [{ index: 1, props: {} }];
    const stations = [{ name: 'S', routes: 'A' }];
    const garages = [{ business_name: 'G', detail: 'D' }];
    const busStops = [{ name: 'B', routes: 'Q' }];
    drawParkingAndTransitPage(pdf, regs, meters, stations, garages, busStops);
    expect(pdf.addPage).toHaveBeenCalled();
    // autotable mock updates pdf.lastAutoTable; ensure it ran at least once
    expect(pdf.lastAutoTable.finalY).toBeGreaterThan(10);
  });
});


