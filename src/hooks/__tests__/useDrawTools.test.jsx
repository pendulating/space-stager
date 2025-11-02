import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDrawTools } from '../useDrawTools.js';

function makeMap() {
  const handlers = new Map();
  return {
    loaded: () => true,
    isStyleLoaded: () => true,
    addControl: vi.fn(),
    removeControl: vi.fn(),
    on: vi.fn((evt, cb) => { handlers.set(evt, cb); }),
    off: vi.fn(),
    fire: vi.fn(),
  };
}

function installMapboxDraw() {
  const modes = { draw_point: {}, draw_line_string: {}, draw_polygon: {}, simple_select: {} };
  const inst = {
    getMode: vi.fn(() => 'simple_select'),
    changeMode: vi.fn(),
    add: vi.fn(),
    delete: vi.fn(),
    deleteAll: vi.fn(),
    getAll: vi.fn(() => ({ features: [] })),
    get: vi.fn(),
  };
  const Ctor = vi.fn(() => inst);
  // eslint-disable-next-line no-global-assign
  globalThis.window.MapboxDraw = Object.assign(Ctor, { modes });
  return { Ctor, inst };
}

describe('useDrawTools', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('initializes draw controls when MapboxDraw is available', () => {
    const map = makeMap();
    const { inst } = installMapboxDraw();
    const { result } = renderHook(() => useDrawTools(map, null));
    expect(map.addControl).toHaveBeenCalled();
    expect(result.current.drawInitialized).toBe(true);

    // Activate simple built-in tools
    act(() => { result.current.activateDrawingTool('point'); });
    expect(inst.changeMode).toHaveBeenCalledWith('draw_point');

    act(() => { result.current.activateDrawingTool('polygon'); });
    expect(inst.changeMode).toHaveBeenCalledWith('draw_polygon');

    // Custom modes fallback should still call changeMode
    act(() => { result.current.activateDrawingTool('text'); });
    expect(inst.changeMode).toHaveBeenCalled();
  });

  it('forceReinitialize rebinds handlers without throwing', () => {
    const map = makeMap();
    installMapboxDraw();
    const { result } = renderHook(() => useDrawTools(map, null));
    act(() => { result.current.forceReinitialize(); });
    // Should not throw and keep initialized true
    expect(result.current.drawInitialized).toBe(true);
  });
});


