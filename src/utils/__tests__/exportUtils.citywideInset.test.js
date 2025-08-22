import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as exportUtils from '../exportUtils.js';

describe('renderCitywideInsetDataUrl', () => {
  const origImage = global.Image;
  beforeEach(() => {
    // Mock Image to immediately load with given width/height
    global.Image = class {
      constructor(){ this.onload = null; this.onerror = null; this.width = 200; this.height = 100; }
      set src(_) { setTimeout(() => this.onload && this.onload(), 0); }
    };
  });
  afterEach(() => { global.Image = origImage; });

  it('returns data URL for valid focusedArea and null for invalid', async () => {
    const area = { geometry: { type: 'Polygon', coordinates: [[[-74.0,40.7],[-74.0,40.8],[-73.9,40.8],[-73.9,40.7],[-74.0,40.7]]] } };
    // Mock canvas 2D context and toDataURL
    const origCreate = document.createElement;
    document.createElement = (tag) => {
      const el = origCreate.call(document, tag);
      if (tag === 'canvas') {
        el.getContext = () => ({
          imageSmoothingEnabled: false,
          setTransform: () => {},
          clearRect: () => {},
          drawImage: () => {},
          beginPath: () => {},
          arc: () => {},
          fill: () => {},
          save: () => {},
          restore: () => {},
          set imageSmoothingQuality(_) {}
        });
        el.toDataURL = () => 'data:image/png;base64,AAAA';
      }
      return el;
    };
    const url = await exportUtils.__renderCitywideInsetDataUrl(area, 120);
    expect(url).toBe('data:image/png;base64,AAAA');
    document.createElement = origCreate;
    const bad = await exportUtils.__renderCitywideInsetDataUrl(null, 120);
    expect(bad).toBeNull();
  });
});


