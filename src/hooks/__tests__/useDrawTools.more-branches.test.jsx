import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { useDrawTools } from '../useDrawTools.js';

function makeMap({ styleReady = true } = {}) {
  const handlers = {};
  return {
    on: (n, cb) => { (handlers[n] ||= []).push(cb); },
    off: (n, cb) => { handlers[n] = (handlers[n] || []).filter(h => h !== cb); },
    once: (n, cb) => { (handlers[n] ||= []).push((...a) => { // one-shot
      handlers[n] = (handlers[n] || []).filter(h => h !== cb);
      cb(...a);
    }); },
    emit: (n, e={}) => { (handlers[n] || []).forEach(cb => cb(e)); },
    loaded: () => true,
    isStyleLoaded: () => styleReady,
    addControl: vi.fn(),
    removeControl: vi.fn(),
  };
}

function makeDraw() {
  const store = new Map();
  const api = {
    getAll: () => ({ type: 'FeatureCollection', features: Array.from(store.values()) }),
    get: (id) => store.get(id),
    add: vi.fn((f) => { const id = f.id || 'id'; store.set(id, { ...f, id }); }),
    delete: vi.fn((id) => { store.delete(id); }),
    deleteAll: vi.fn(() => { store.clear(); }),
    changeMode: vi.fn(),
  };
  api.add({ id: 'seed', type: 'Feature', properties: { label: 'L' }, geometry: { type: 'Point', coordinates: [0,0] } });
  return api;
}

describe('useDrawTools more branches', () => {
  it('updateShapeLabel, renameShape, select/delete/clear functions operate on draw', async () => {
    const map = makeMap();
    const fakeDraw = makeDraw();
    global.window.MapboxDraw = vi.fn(() => fakeDraw);
    global.window.MapboxDraw.modes = {};

    function Harness() {
      const tools = useDrawTools(map);
      return (
        <div>
          <button onClick={() => {
            fakeDraw.add({ id: 'a', properties: { label: '' }, geometry: { type: 'Point', coordinates: [0,0] } });
            tools.selectShape('a');
            tools.setShapeLabel('New');
            tools.updateShapeLabel();
            tools.renameShape('a', 'Renamed');
          }}>step1</button>
          <button onClick={() => {
            tools.deleteSelectedShape();
            tools.clearCustomShapes();
          }}>step2</button>
        </div>
      );
    }

    const spyDispatch = vi.spyOn(window, 'dispatchEvent');
    const { getByText } = render(<Harness />);
    await act(async () => { fireEvent.click(getByText('step1')); });
    // Allow state to flush
    await act(async () => {});
    await act(async () => { fireEvent.click(getByText('step2')); });
    expect(fakeDraw.add).toHaveBeenCalled();
    expect(spyDispatch).toHaveBeenCalled();
    expect(fakeDraw.delete).toHaveBeenCalled();
    expect(fakeDraw.deleteAll).toHaveBeenCalled();
    spyDispatch.mockRestore();
  });

  it('reinitializeDrawControls waits for style.load when not ready and then rebinds', async () => {
    const map = makeMap({ styleReady: false });
    const fakeDraw = makeDraw();
    global.window.MapboxDraw = vi.fn(() => fakeDraw);
    global.window.MapboxDraw.modes = {};

    function Harness() {
      const tools = useDrawTools(map);
      return (
        <div>
          <button onClick={() => tools.reinitializeDrawControls()}>reinit</button>
        </div>
      );
    }

    const { getByText } = render(<Harness />);
    fireEvent.click(getByText('reinit'));
    await act(async () => { map.emit('style.load'); });
    expect(map.addControl).toHaveBeenCalled();
  });

  it('activateDrawingTool default path resets to simple_select', () => {
    const map = makeMap();
    const fakeDraw = makeDraw();
    global.window.MapboxDraw = vi.fn(() => fakeDraw);
    global.window.MapboxDraw.modes = {};

    function Harness() {
      const tools = useDrawTools(map);
      return <button onClick={() => tools.activateDrawingTool('unknown')}>go</button>;
    }
    const { getByText } = render(<Harness />);
    fireEvent.click(getByText('go'));
    expect(fakeDraw.changeMode).toHaveBeenCalledWith('simple_select');
  });

  it('style.load rebind removes and re-adds draw control and restores shapes', async () => {
    const map = makeMap();
    const fakeDraw = makeDraw();
    global.window.MapboxDraw = vi.fn(() => fakeDraw);
    global.window.MapboxDraw.modes = {};

    function Harness() {
      useDrawTools(map);
      return <div/>;
    }
    render(<Harness />);
    await act(async () => { map.emit('style.load'); });
    expect(map.removeControl).toHaveBeenCalled();
    expect(map.addControl).toHaveBeenCalled();
    expect(fakeDraw.add).toHaveBeenCalled();
  });
});


