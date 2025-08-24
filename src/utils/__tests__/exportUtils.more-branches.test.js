import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __getPermitAreaBounds, exportPermitAreaSiteplanV2 } from '../exportUtils.js';

describe('exportUtils: additional branches', () => {
  const origAlert = global.alert;
  const origCreate = document.createElement;

  beforeEach(() => {
    global.alert = vi.fn();
    document.createElement = (tag) => {
      const el = origCreate.call(document, tag);
      if (tag === 'canvas') {
        el.getContext = () => ({
          imageSmoothingEnabled: true,
          setTransform: () => {},
          clearRect: () => {},
          drawImage: () => {},
          fillRect: () => {},
          beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {},
        });
        el.toDataURL = () => 'data:image/png;base64,BASE';
      }
      return el;
    };
  });

  afterEach(() => {
    global.alert = origAlert;
    document.createElement = origCreate;
  });

  it('__getPermitAreaBounds handles Polygon and MultiPolygon', () => {
    const poly = { type: 'Polygon', coordinates: [[[-74,40.7],[-73.95,40.7],[-73.95,40.72],[-74,40.72],[-74,40.7]]] };
    const mp = { type: 'MultiPolygon', coordinates: [[[[-74,40.7],[-73.95,40.7],[-73.95,40.72],[-74,40.72],[-74,40.7]]]] };
    const b1 = __getPermitAreaBounds({ geometry: poly });
    const b2 = __getPermitAreaBounds({ geometry: mp });
    expect(Array.isArray(b1) && b1.length === 2).toBe(true);
    expect(Array.isArray(b2) && b2.length === 2).toBe(true);
  });

  it('exportPermitAreaSiteplanV2 alerts when map or focusedArea missing', async () => {
    await exportPermitAreaSiteplanV2(null, null, {}, [], [], 'png');
    expect(global.alert).toHaveBeenCalled();
  });
});


