import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useDrawTools } from '../useDrawTools.js';

function makeMap() {
  const handlers = {};
  return {
    on: (n, cb) => { (handlers[n] ||= []).push(cb); },
    off: (n, cb) => { handlers[n] = (handlers[n] || []).filter(h => h !== cb); },
    once: (n, cb) => { (handlers[n] ||= []).push(cb); },
    emit: (n, e={}) => { (handlers[n] || []).forEach(cb => cb(e)); },
    loaded: () => true,
    isStyleLoaded: () => true,
    addControl: vi.fn(),
    removeControl: vi.fn(),
    getStyle: () => ({ layers: [] })
  };
}

function makeDraw() {
  return {
    getAll: () => ({ type: 'FeatureCollection', features: [] }),
    add: vi.fn(),
    changeMode: vi.fn(),
    deleteAll: vi.fn()
  };
}

describe('useDrawTools reinitialize/resilience', () => {
  it('rebinds draw control on style.load without losing shapes', async () => {
    const map = makeMap();
    const draw = makeDraw();
    const ctor = vi.fn(() => draw);
    window.MapboxDraw = ctor;
    window.MapboxDraw.modes = {};

    function Harness(){
      const tools = useDrawTools(map);
      return <div data-testid="ok">{String(!!tools.draw)}</div>;
    }

    render(<Harness />);
    // Initially added
    expect(map.addControl).toHaveBeenCalledWith(draw);

    // Seed shapes and flip style.load to trigger rebind path
    const existing = { type: 'FeatureCollection', features: [{ id: 'a', type: 'Feature', geometry: { type: 'Point', coordinates: [0,0] } }] };
    draw.getAll = () => existing;

    // Trigger style.load handler
    act(() => { map.emit('style.load'); });

    // Should remove and add control to rebind
    expect(map.removeControl).toHaveBeenCalledWith(draw);
    expect(map.addControl).toHaveBeenCalledWith(draw);
    // Should attempt to re-add existing features
    expect(draw.add).toHaveBeenCalledWith(existing);
  });

  it('manual reinitialize keeps drawInitialized true and handlers bound', () => {
    const map = makeMap();
    const draw = makeDraw();
    window.MapboxDraw = vi.fn(() => draw);
    window.MapboxDraw.modes = {};

    let api;
    function Harness(){ api = useDrawTools(map); return <div />; }
    render(<Harness />);

    // Simulate manual reinitialize call
    act(() => { api.reinitializeDrawControls(); });
    expect(map.addControl).toHaveBeenCalledWith(draw);
    // drawInitialized flag should remain true (implicitly: no crash)
    expect(api.drawInitialized).toBe(true);
  });
});


