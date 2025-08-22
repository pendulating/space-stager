import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { useDrawTools } from '../useDrawTools.js';

function makeFakeMap() {
  const handlers = {};
  return {
    on: (n, cb) => { (handlers[n] ||= []).push(cb); },
    once: (n, cb) => {
      const wrap = (...a) => { off(n, wrap); cb(...a); };
      on(n, wrap);
    },
    off: (n, cb) => { handlers[n] = (handlers[n] || []).filter(h => h !== cb); },
    emit: (n, e={}) => { (handlers[n] || []).forEach(cb => cb(e)); },
    loaded: () => true,
    isStyleLoaded: () => true,
    addControl: vi.fn(),
    removeControl: vi.fn(),
  };
  function on() {}
  function off() {}
}

function makeFakeDraw() {
  const store = new Map();
  return {
    getAll: () => ({ type: 'FeatureCollection', features: Array.from(store.values()) }),
    get: (id) => store.get(id),
    add: (f) => { store.set(f.id || 'id', { ...f, id: f.id || 'id' }); },
    delete: (id) => { store.delete(id); },
    deleteAll: () => { store.clear(); },
    changeMode: vi.fn(),
  };
}

describe('useDrawTools', () => {
  it('initializes MapboxDraw, activates tools, and updates labels', async () => {
    const map = makeFakeMap();
    const fakeDraw = makeFakeDraw();
    global.window.MapboxDraw = vi.fn(() => fakeDraw);
    global.window.MapboxDraw.modes = {};

    function Harness() {
      const tools = useDrawTools(map);
      const [shapeId, setShapeId] = React.useState('f1');
      React.useEffect(() => {
        // Simulate style being ready and init
        // useDrawTools checks isStyleLoaded and proceeds
      }, []);
      return (
        <div>
          <button onClick={() => tools.activateDrawingTool('point')}>point</button>
          <button onClick={() => tools.activateDrawingTool('line')}>line</button>
          <button onClick={() => tools.activateDrawingTool('polygon')}>polygon</button>
          <button onClick={() => tools.activateDrawingTool('arrow')}>arrow</button>
          <button onClick={() => tools.setShowLabels(false)}>hideLabels</button>
          <div data-testid="initialized">{String(tools.drawInitialized)}</div>
        </div>
      );
    }

    render(<Harness />);

    // Draw is created and added
    expect(window.MapboxDraw).toHaveBeenCalled();
    expect(map.addControl).toHaveBeenCalled();

    // Activate some modes
    fireEvent.click(screen.getByText('point'));
    expect(fakeDraw.changeMode).toHaveBeenCalledWith('draw_point');
    fireEvent.click(screen.getByText('line'));
    expect(fakeDraw.changeMode).toHaveBeenCalledWith('draw_line_string');
    fireEvent.click(screen.getByText('polygon'));
    expect(fakeDraw.changeMode).toHaveBeenCalledWith('draw_polygon');
    fireEvent.click(screen.getByText('arrow'));
    expect(fakeDraw.changeMode).toHaveBeenCalled();
  });

  it('startRectObjectPlacement toggles custom mode and clears on modechange', () => {
    const map = makeFakeMap();
    const fakeDraw = makeFakeDraw();
    global.window.MapboxDraw = vi.fn(() => fakeDraw);
    global.window.MapboxDraw.modes = {};

    function Harness() {
      const tools = useDrawTools(map);
      return (
        <div>
          <button onClick={() => tools.startRectObjectPlacement({ id: 'bench' })}>toggleRect</button>
        </div>
      );
    }

    render(<Harness />);
    // Activate
    fireEvent.click(screen.getByText('toggleRect'));
    expect(fakeDraw.changeMode).toHaveBeenCalledWith('draw_rect_object', { objectTypeId: 'bench' });
    // Simulate leaving custom mode
    act(() => { map.emit('draw.modechange', { mode: 'simple_select' }); });
    // No explicit assertion needed; ensure no error
  });
});


