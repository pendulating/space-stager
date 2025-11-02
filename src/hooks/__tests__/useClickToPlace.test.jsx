import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../../constants/placeableObjects.js', () => ({
  PLACEABLE_OBJECTS: [
    { id: 'bench', name: 'Bench', size: { width: 40, height: 20 }, color: '#123456' },
    { id: 'banner', name: 'Banner', size: { width: 60, height: 30 }, color: '#abcdef' }
  ]
}));

vi.mock('../useGlobalKeymap.js', () => ({ useGlobalKeymap: () => {} }));
vi.mock('/Users/mattfranchi/Repos/space-stager/src/hooks/useGlobalKeymap', () => ({ useGlobalKeymap: () => {} }));
vi.mock('/Users/mattfranchi/Repos/space-stager/src/hooks/useGlobalKeymap.js', () => ({ useGlobalKeymap: () => {} }));
import { useClickToPlace } from '../useClickToPlace.js';

function makeFakeMap() {
  const handlers = {};
  const mapEl = document.createElement('div');
  mapEl.getBoundingClientRect = () => ({ left: 10, top: 20, width: 800, height: 600 });
  return {
    on: (n, cb) => { (handlers[n] ||= []).push(cb); },
    off: (n, cb) => { handlers[n] = (handlers[n] || []).filter(h => h !== cb); },
    once: (n, cb) => { const wrap = (...a) => { off(n, wrap); cb(...a); }; on(n, wrap); },
    emit: (n, e={}) => { (handlers[n] || []).forEach(cb => cb(e)); },
    loaded: () => true,
    getContainer: () => mapEl,
    unproject: ([x, y]) => ({ lng: x / 100, lat: y / 100 }),
    project: ([lng, lat]) => ({ x: lng * 10, y: lat * 10 })
  };
  function on() {}
  function off() {}
}

function Harness({ map }) {
  const hook = useClickToPlace(map);
  return (
    <div>
      <div data-testid="count">{hook.droppedObjects.length}</div>
      <div data-testid="mode">{hook.placementMode ? hook.placementMode.objectType.id : 'none'}</div>
      <div data-testid="rotation">{hook.placementMode ? String(hook.placementMode.rotationDeg) : 'na'}</div>
      <div data-testid="cursor">{hook.cursorPosition ? `${hook.cursorPosition.lng},${hook.cursorPosition.lat}` : 'none'}</div>
      <div data-testid="updates">{String(hook.objectUpdateTrigger)}</div>
      <button onClick={() => hook.activatePlacementMode({ id: 'bench', name: 'Bench' }, false)}>mode-bench</button>
      <button onClick={() => hook.activatePlacementMode({ id: 'bench', name: 'Bench' }, true)}>mode-bench-batch</button>
      <button onClick={() => hook.cancelPlacementMode()}>cancel</button>
      <button onClick={() => hook.clearDroppedObjects()}>clear</button>
    </div>
  );
}

describe('useClickToPlace', () => {
  it('increments update trigger on placement', () => {
    const map = makeFakeMap();
    function PlaceHarness() {
      const hook = useClickToPlace(map);
      return (
        <div>
          <div data-testid="updates">{String(hook.objectUpdateTrigger)}</div>
          <button onClick={() => hook.activatePlacementMode({ id: 'bench', name: 'Bench' }, false)}>mode</button>
          <button onClick={() => hook.handleMapClick({ preventDefault(){}, stopPropagation(){}, clientX: 110, clientY: 220 })}>place</button>
        </div>
      );
    }
    render(<PlaceHarness />);
    const before = screen.getByTestId('updates').textContent;
    act(() => { screen.getByText('mode').click(); });
    act(() => { screen.getByText('place').click(); });
    const after = screen.getByTestId('updates').textContent;
    expect(Number(after)).toBe(Number(before) + 1);
  });

  it('activates/toggles placement mode and rotates via API', () => {
    const map = makeFakeMap();
    function RotateHarness() {
      const hook = useClickToPlace(map);
      return (
        <div>
          <div data-testid="mode">{hook.placementMode ? hook.placementMode.objectType.id : 'none'}</div>
          <div data-testid="rotation">{hook.placementMode ? String(hook.placementMode.rotationDeg) : 'na'}</div>
          <button onClick={() => hook.activatePlacementMode({ id: 'bench', name: 'Bench' }, false)}>mode-bench</button>
          <button onClick={() => hook.rotatePlacementModeBy(45)}>rotate</button>
        </div>
      );
    }
    render(<RotateHarness />);
    fireEvent.click(screen.getByText('mode-bench'));
    expect(screen.getByTestId('mode').textContent).toBe('bench');
    act(() => { screen.getByText('rotate').click(); });
    expect(screen.getByTestId('rotation').textContent).toBe('45');
    // toggling same object cancels
    fireEvent.click(screen.getByText('mode-bench'));
    expect(screen.getByTestId('mode').textContent).toBe('none');
  });

  // Removed: covered by 'places object...' test which asserts cursor updates on move

  it('getObjectStyle computes absolute position and size from map.project', () => {
    const map = makeFakeMap();
    function StyleHarness() {
      const hook = useClickToPlace(map);
      const obj = { id: 'o1', type: 'bench', position: { lng: 10, lat: 20 } };
      const style = hook.getObjectStyle(obj);
      return (
        <div>
          <div data-testid="left">{String(style.left)}</div>
          <div data-testid="top">{String(style.top)}</div>
          <div data-testid="w">{String(style.width)}</div>
          <div data-testid="h">{String(style.height)}</div>
        </div>
      );
    }
    render(<StyleHarness />);
    // project returns (x=100, y=200); width=40 height=20
    expect(screen.getByTestId('left').textContent).toBe(String(100 - 20));
    expect(screen.getByTestId('top').textContent).toBe(String(200 - 10));
    expect(screen.getByTestId('w').textContent).toBe('40');
    expect(screen.getByTestId('h').textContent).toBe('20');
  });
});


